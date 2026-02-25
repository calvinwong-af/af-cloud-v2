/**
 * AcceleFreight Platform — Companies Write Operations
 *
 * Server-side only. Creates, updates, and soft-deletes Company Kind in Datastore.
 * Generates sequential company_id (AFC-XXXXXX) via AFCountID Kind.
 *
 * Three Core Pillars: process logging, error handling, security (caller enforces auth).
 */

import { getDatastore } from './datastore-query';
import type { Company, CompanyAddress } from './types';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCompanyInput {
  name: string;
  short_name?: string;
  registration_number?: string;
  address?: CompanyAddress;
  contact_info?: Company['contact_info'];
  preferred_currency?: string;
  tags?: string[];
}

export interface UpdateCompanyInput {
  name?: string;
  short_name?: string;
  registration_number?: string;
  address?: CompanyAddress;
  contact_info?: Company['contact_info'];
  preferred_currency?: string;
  approved?: boolean;
  allow_access?: boolean;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Generate next company ID — AFC-XXXX via max countid query
// ---------------------------------------------------------------------------

async function nextCompanyId(): Promise<{ company_id: string; countid: number }> {
  const ds = getDatastore();
  let maxCountId = 641; // hard floor — existing production records go up to AFC-0641

  try {
    const query = ds.createQuery('Company')
      .order('countid', { descending: true })
      .limit(1);
    const [entities] = await ds.runQuery(query);
    if (entities.length > 0 && entities[0].countid) {
      const queried = parseInt(entities[0].countid, 10);
      // Only trust the queried value if it's above the known floor
      // Guards against index fallback returning a stale low value
      if (queried > maxCountId) {
        maxCountId = queried;
      }
    }
  } catch (e) {
    // Index not ready — fall through and use floor value
    console.warn('[createCompany] countid query failed, using floor:', e);
  }

  const newCountId = maxCountId + 1;
  const company_id = 'AFC-' + String(newCountId).padStart(4, '0');
  return { company_id, countid: newCountId };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createCompany(input: CreateCompanyInput, creatorEmail?: string): Promise<Company> {
  if (!input.name?.trim()) {
    throw new Error('Company name is required');
  }

  const { company_id, countid } = await nextCompanyId();
  const datastore = getDatastore();
  const now = new Date().toISOString();

  const company: Company = {
    company_id,
    countid,
    name: input.name.trim(),
    short_name: input.short_name?.trim() || input.name.trim(),
    registration_number: input.registration_number?.trim() || '',
    address: input.address ?? {},
    contact_info: input.contact_info ?? {},
    contact_persons: [],
    preferred_currency: input.preferred_currency || 'MYR',
    approved: false,
    allow_access: false,
    xero_id: null,
    xero_sync: false,
    xero_sync_required: false,
    tags: input.tags ?? [],
    files: [],
    trash: false,
    user: creatorEmail ?? '',
    created: now,
    updated: now,
  };

  const entityKey = datastore.key(['Company', company_id]);
  await datastore.save({
    key: entityKey,
    data: company,
    excludeFromIndexes: [
      'registration_number', 'address', 'contact_info', 'contact_persons',
      'files', 'xero_id',
    ],
  });

  return company;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput
): Promise<Company> {
  if (!companyId) throw new Error('Company ID is required');

  const datastore = getDatastore();
  const key = datastore.key(['Company', companyId]);
  const [entity] = await datastore.get(key);

  if (!entity) throw new Error(`Company ${companyId} not found`);

  const raw = entity as Record<string, unknown>;
  const now = new Date().toISOString();

  // Merge only provided fields
  if (input.name !== undefined) raw.name = input.name.trim();
  if (input.short_name !== undefined) raw.short_name = input.short_name.trim();
  if (input.registration_number !== undefined) raw.registration_number = input.registration_number.trim();
  if (input.address !== undefined) raw.address = input.address;
  if (input.contact_info !== undefined) raw.contact_info = input.contact_info;
  if (input.preferred_currency !== undefined) raw.preferred_currency = input.preferred_currency;
  if (input.approved !== undefined) raw.approved = input.approved;
  if (input.allow_access !== undefined) raw.allow_access = input.allow_access;
  if (input.tags !== undefined) raw.tags = input.tags;
  raw.updated = now;

  await datastore.save({
    key,
    data: raw,
    excludeFromIndexes: [
      'registration_number', 'address', 'contact_info', 'contact_persons',
      'files', 'xero_id',
    ],
  });

  // Return updated company
  const { toCompany } = await import('./companies');
  return toCompany(raw);
}

// ---------------------------------------------------------------------------
// Soft delete (trash)
// ---------------------------------------------------------------------------

export async function deleteCompany(companyId: string): Promise<void> {
  if (!companyId) throw new Error('Company ID is required');

  const datastore = getDatastore();
  const key = datastore.key(['Company', companyId]);
  const [entity] = await datastore.get(key);

  if (!entity) throw new Error(`Company ${companyId} not found`);

  const raw = entity as Record<string, unknown>;
  raw.trash = true;
  raw.updated = new Date().toISOString();

  await datastore.save({
    key,
    data: raw,
    excludeFromIndexes: [
      'registration_number', 'address', 'contact_info', 'contact_persons',
      'files', 'xero_id',
    ],
  });
}
