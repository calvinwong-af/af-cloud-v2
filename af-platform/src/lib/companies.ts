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
function toCompany(raw: Record<string, any>): Company {
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
  const { excludeTrash = true, limit = 200 } = options;
  const datastore = getDatastore();

  let query = datastore.createQuery('Company');
  if (excludeTrash) {
    query = query.filter('trash', '=', false);
  }
  query = query.order('name').limit(limit);

  const [entities] = await datastore.runQuery(query);

  let companies = entities.map((e) => toCompany(e as Record<string, unknown>));

  // Client-side search (Datastore text search is limited)
  if (options.search) {
    const term = options.search.toLowerCase();
    companies = companies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.company_id.toLowerCase().includes(term) ||
        c.short_name.toLowerCase().includes(term)
    );
  }

  return companies;
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
