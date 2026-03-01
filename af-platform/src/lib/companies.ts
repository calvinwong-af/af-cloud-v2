/**
 * AcceleFreight Platform — Companies Data Layer
 *
 * Server-side only. Reads Company Kind from Datastore.
 * Applies all required defaults per AF-Status-Codes-and-Field-Defaults.md.
 *
 * Three Core Pillars: process logging, error handling, security (caller enforces auth).
 */

import { getDatastore } from './datastore-query';
import type { Company } from './types';

// ---------------------------------------------------------------------------
// Defensive read helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCompany(raw: Record<string, any>): Company {
  return {
    company_id:          raw.company_id as string ?? '',
    countid:             raw.countid as number ?? 0,
    name:                raw.name as string ?? '',
    short_name:          raw.short_name as string ?? raw.name ?? '',
    registration_number: raw.registration_number as string ?? '',
    address:             raw.address as Company['address'] ?? {},
    contact_info:        raw.contact_info as Company['contact_info'] ?? {},
    contact_persons:     raw.contact_persons as Company['contact_persons'] ?? [],
    preferred_currency:  raw.preferred_currency as string ?? 'MYR',
    approved:            raw.approved as boolean ?? false,
    allow_access:        raw.allow_access as boolean ?? false,
    xero_id:             raw.xero_id as string | null ?? null,
    xero_sync:           raw.xero_sync as boolean ?? false,
    xero_sync_required:  raw.xero_sync_required as boolean ?? false,   // 27.5% missing
    tags:                raw.tags as string[] ?? [],                    // 0.3% missing
    files:               raw.files as string[] ?? [],
    trash:               raw.trash as boolean ?? false,
    user:                raw.user as string ?? '',
    created:             raw.created as string ?? '',
    updated:             raw.updated as string ?? '',
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface GetCompaniesOptions {
  /** Skip soft-deleted records (default: true) */
  excludeTrash?: boolean;
  /** Search by name / company_id */
  search?: string;
  /** Limit (default: 200 for list views) */
  limit?: number;
}

export async function getCompanies(
  options: GetCompaniesOptions = {}
): Promise<Company[]> {
  const { search } = options;
  const ds = getDatastore();

  const query = ds.createQuery('Company')
    .filter('trash', '=', false);

  const [entities] = await ds.runQuery(query);

  // Sort, filter and paginate in JavaScript — avoids composite index requirement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results = entities.map((e: any) => ({
    company_id:          e.company_id          ?? null,
    name:                e.name                ?? '',
    short_name:          e.short_name          ?? '',
    registration_number: e.registration_number ?? null,
    preferred_currency:  e.preferred_currency  ?? 'MYR',
    address:             e.address             ?? null,
    contact_info:        e.contact_info        ?? null,
    contact_persons:     e.contact_persons     ?? [],
    approved:            e.approved            ?? false,
    allow_access:        e.allow_access        ?? false,
    xero_id:             e.xero_id             ?? null,
    xero_sync:           e.xero_sync           ?? false,
    xero_sync_required:  e.xero_sync_required  ?? false,
    tags:                e.tags                ?? [],
    files:               e.files               ?? [],
    countid:             e.countid             ?? 0,
    trash:               false,
    user:                e.user                ?? null,
    created:             e.created             ?? null,
    updated:             e.updated             ?? null,
  }));

  // Apply search filter if provided
  if (search) {
    const q = search.toLowerCase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results = results.filter((c: any) =>
      c.name.toLowerCase().includes(q) ||
      c.company_id?.toLowerCase().includes(q) ||
      c.short_name?.toLowerCase().includes(q)
    );
  }

  // Sort by name alphabetically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results.sort((a: any, b: any) => a.name.localeCompare(b.name));

  return results;
}

export async function getCompanyById(companyId: string): Promise<Company | null> {
  if (!companyId) return null;
  const datastore = getDatastore();

  const key = datastore.key(['Company', companyId]);
  const [entity] = await datastore.get(key);
  if (!entity) return null;

  return toCompany(entity as Record<string, unknown>);
}

/**
 * Returns a Map<company_id, Company> for efficient lookups during assembly.
 * Used by the V1 read assembly layer.
 */
export async function getCompanyMap(
  companyIds: string[]
): Promise<Map<string, Company>> {
  if (!companyIds.length) return new Map();

  const datastore = getDatastore();
  const keys = Array.from(new Set(companyIds)).map((id) => datastore.key(['Company', id]));
  const [entities] = await datastore.get(keys);

  const map = new Map<string, Company>();
  for (const entity of entities) {
    if (!entity) continue;
    const c = toCompany(entity as Record<string, unknown>);
    if (c.company_id) map.set(c.company_id, c);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Stats helper (used by dashboard)
// ---------------------------------------------------------------------------

export interface CompanyStats {
  total: number;
  approved: number;
  with_access: number;
  xero_synced: number;
}

export async function getCompanyStats(): Promise<CompanyStats> {
  const companies = await getCompanies({ limit: 2000 });
  return {
    total: companies.length,
    approved: companies.filter((c) => c.approved).length,
    with_access: companies.filter((c) => c.allow_access).length,
    xero_synced: companies.filter((c) => c.xero_sync).length,
  };
}

// ---------------------------------------------------------------------------
// Company Users — linked user accounts
// ---------------------------------------------------------------------------

export interface CompanyUser {
  uid: string;
  name: string;
  email: string;
  role: string | null;
  account_type: string;
  valid_access: boolean;
  email_validated: boolean;
  created: string | null;
}

export async function getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  try {
    if (!companyId) return [];
    const datastore = getDatastore();

    // Query by company_id field
    const query1 = datastore.createQuery('CompanyUserAccount').filter('company_id', '=', companyId);
    const [entities1] = await datastore.runQuery(query1);

    // Query by company_key (Key ref) — handles the 54% broken case
    const companyKey = datastore.key(['Company', companyId]);
    const query2 = datastore.createQuery('CompanyUserAccount').filter('company_key', '=', companyKey);
    const [entities2] = await datastore.runQuery(query2);

    // Merge and deduplicate by uid
    const uidMap = new Map<string, string>();
    for (const e of [...entities1, ...entities2]) {
      const uid = (e as Record<string, unknown>).uid as string;
      if (uid && !uidMap.has(uid)) uidMap.set(uid, uid);
    }

    const uids = Array.from(uidMap.keys());
    if (!uids.length) return [];

    // Batch fetch UserAccount + UserIAM
    const accountKeys = uids.map((uid) => datastore.key(['UserAccount', uid]));
    const iamKeys = uids.map((uid) => datastore.key(['UserIAM', uid]));

    const [[accounts], [iams]] = await Promise.all([
      datastore.get(accountKeys),
      datastore.get(iamKeys),
    ]);

    const iamByUid = new Map<string, Record<string, unknown>>();
    for (const iam of iams) {
      if (!iam) continue;
      const raw = iam as Record<string, unknown>;
      const uid = raw.uid as string;
      if (uid) iamByUid.set(uid, raw);
    }

    const users: CompanyUser[] = [];
    for (const acct of accounts) {
      if (!acct) continue;
      const raw = acct as Record<string, unknown>;
      const uid = raw.uid as string ?? '';
      const iam = iamByUid.get(uid);

      users.push({
        uid,
        name: `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim() || ((raw.email as string) ?? ''),
        email: raw.email as string ?? '',
        role: (iam?.role as string) ?? null,
        account_type: raw.account_type as string ?? 'AFC',
        valid_access: (iam?.valid_access as boolean) ?? false,
        email_validated: (raw.email_validated as boolean) ?? false,
        created: raw.created as string ?? raw.created_at as string ?? null,
      });
    }

    return users;
  } catch (err) {
    console.error('[getCompanyUsers]', err);
    return [];
  }
}

