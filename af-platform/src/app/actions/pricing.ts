'use server';
/**
 * Pricing Server Actions — dashboard, FCL/LCL rate cards.
 */

import { verifySessionAndRole } from '@/lib/auth-server';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function getToken(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  return cookieStore.get('af-session')?.value ?? null;
}

async function pricingFetch<T>(path: string): Promise<ActionResult<T>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return { success: false, error: 'Server URL not configured' };

    const url = new URL(path, serverUrl);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Server responded ${res.status}: ${text}` };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? json };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

// ---------------------------------------------------------------------------
// Country list for pricing filter
// ---------------------------------------------------------------------------

export interface PricingCountry {
  country_code: string;
  country_name: string;
}

export async function fetchPricingCountriesAction(): Promise<ActionResult<PricingCountry[]>> {
  return pricingFetch('/api/v2/pricing/countries');
}

// ---------------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------------

export interface DashboardComponentSummary {
  total_cards: number;
  last_updated: string | null;
  expiring_soon: number;
}

export interface DashboardSummary {
  fcl: DashboardComponentSummary;
  lcl: DashboardComponentSummary;
}

export async function fetchPricingDashboardSummaryAction(
  countryCode?: string
): Promise<ActionResult<DashboardSummary>> {
  const params = new URLSearchParams();
  if (countryCode) params.set('country_code', countryCode);
  const qs = params.toString();
  return pricingFetch(`/api/v2/pricing/dashboard-summary${qs ? `?${qs}` : ''}`);
}

// ---------------------------------------------------------------------------
// Origin port lists
// ---------------------------------------------------------------------------

export async function fetchFCLOriginsAction(
  countryCode?: string
): Promise<ActionResult<string[]>> {
  const params = new URLSearchParams({ is_active: 'true' });
  if (countryCode) params.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/fcl/origins?${params.toString()}`);
}

export async function fetchLCLOriginsAction(
  countryCode?: string
): Promise<ActionResult<string[]>> {
  const params = new URLSearchParams({ is_active: 'true' });
  if (countryCode) params.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/lcl/origins?${params.toString()}`);
}

// ---------------------------------------------------------------------------
// FCL rate cards
// ---------------------------------------------------------------------------

export interface RateCard {
  id: number;
  rate_card_key: string;
  origin_port_code: string;
  destination_port_code: string;
  dg_class_code: string;
  container_size?: string;
  container_type?: string;
  code: string;
  description: string;
  terminal_id: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  latest_price_ref?: {
    list_price: number | null;
    currency: string;
    effective_from: string | null;
  } | null;
}

export interface RateDetail {
  id: number;
  rate_card_id: number;
  supplier_id: string | null;
  effective_from: string | null;
  rate_status: string;
  currency: string;
  uom: string;
  list_price: number | null;
  min_list_price: number | null;
  cost: number | null;
  min_cost: number | null;
  roundup_qty: number;
  lss: number | null;
  baf: number | null;
  ecrs: number | null;
  psc: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RateCardDetail extends RateCard {
  rates_by_supplier: Record<string, RateDetail[]>;
}

export async function fetchFCLRateCardsAction(params: {
  countryCode?: string;
  originPort?: string;
  destPort?: string;
  containerSize?: string;
  isActive?: boolean;
}): Promise<ActionResult<RateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.originPort) sp.set('origin_port_code', params.originPort);
  if (params.destPort) sp.set('destination_port_code', params.destPort);
  if (params.containerSize) sp.set('container_size', params.containerSize);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/fcl/rate-cards${qs ? `?${qs}` : ''}`);
}

export async function fetchFCLRateCardDetailAction(
  cardId: number
): Promise<ActionResult<RateCardDetail>> {
  return pricingFetch(`/api/v2/pricing/fcl/rate-cards/${cardId}`);
}

// ---------------------------------------------------------------------------
// LCL rate cards
// ---------------------------------------------------------------------------

export async function fetchLCLRateCardsAction(params: {
  countryCode?: string;
  originPort?: string;
  destPort?: string;
  isActive?: boolean;
}): Promise<ActionResult<RateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.originPort) sp.set('origin_port_code', params.originPort);
  if (params.destPort) sp.set('destination_port_code', params.destPort);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/lcl/rate-cards${qs ? `?${qs}` : ''}`);
}

export async function fetchLCLRateCardDetailAction(
  cardId: number
): Promise<ActionResult<RateCardDetail>> {
  return pricingFetch(`/api/v2/pricing/lcl/rate-cards/${cardId}`);
}
