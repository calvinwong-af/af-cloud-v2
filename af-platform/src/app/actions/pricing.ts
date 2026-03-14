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

async function pricingMutate<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ActionResult<T>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return { success: false, error: 'Server URL not configured' };

    const url = new URL(path, serverUrl);
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
  cost_exceeds_price: number;
  no_active_cost: number;
  no_list_price: number;
  price_review_needed: number;
}

export interface DashboardSummary {
  fcl: DashboardComponentSummary;
  lcl: DashboardComponentSummary;
  'local-charges': DashboardComponentSummary;
  customs: DashboardComponentSummary;
  'port-transport': DashboardComponentSummary;
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
  terminal_name: string | null;
  latest_list_price_from: string | null;
  latest_cost_from: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  pending_draft_count?: number;
  latest_price_ref?: {
    list_price: number | null;
    currency: string;
    effective_from: string | null;
  } | null;
  time_series?: Array<{
    month_key: string;
    list_price: number | null;
    cost: number | null;
    min_quantity: number | null;
    currency: string | null;
    rate_status: string | null;
    surcharge_total: number;
    list_surcharge_total?: number;
    cost_surcharge_total?: number;
    has_surcharges: boolean;
  }>;
}

export interface SurchargeItem {
  code: string;
  description: string;
  amount: number;
}

export interface RateDetail {
  id: number;
  rate_card_id: number;
  supplier_id: string | null;
  effective_from: string | null;
  effective_to: string | null; // ISO date or null for open-ended
  rate_status: string;
  currency: string;
  uom: string;
  list_price: number | null;
  cost: number | null;
  min_quantity: number | null;
  roundup_qty: number;
  surcharges: SurchargeItem[] | null;
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
  alertsOnly?: boolean;
}): Promise<ActionResult<RateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.originPort) sp.set('origin_port_code', params.originPort);
  if (params.destPort) sp.set('destination_port_code', params.destPort);
  if (params.containerSize) sp.set('container_size', params.containerSize);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  if (params.alertsOnly) sp.set('alerts_only', 'true');
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
  alertsOnly?: boolean;
}): Promise<ActionResult<RateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.originPort) sp.set('origin_port_code', params.originPort);
  if (params.destPort) sp.set('destination_port_code', params.destPort);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  if (params.alertsOnly) sp.set('alerts_only', 'true');
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/lcl/rate-cards${qs ? `?${qs}` : ''}`);
}

export async function fetchLCLRateCardDetailAction(
  cardId: number
): Promise<ActionResult<RateCardDetail>> {
  return pricingFetch(`/api/v2/pricing/lcl/rate-cards/${cardId}`);
}

// ---------------------------------------------------------------------------
// Rate CRUD actions
// ---------------------------------------------------------------------------

interface RateCreateData {
  supplier_id: string | null;
  effective_from: string;
  effective_to: string | null;
  currency: string;
  uom: string;
  list_price: number | null;
  cost: number | null;
  min_quantity: number | null;
  surcharges: SurchargeItem[] | null;
  rate_status: string;
}

interface RateUpdateData {
  effective_from?: string;
  effective_to?: string | null;
  currency?: string;
  list_price?: number | null;
  cost?: number | null;
  min_quantity?: number | null;
  surcharges?: SurchargeItem[] | null;
  rate_status?: string;
}

export async function createFCLRateAction(
  cardId: number,
  data: RateCreateData,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate(`/api/v2/pricing/fcl/rate-cards/${cardId}/rates`, 'POST', data);
}

export async function createLCLRateAction(
  cardId: number,
  data: RateCreateData,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate(`/api/v2/pricing/lcl/rate-cards/${cardId}/rates`, 'POST', data);
}

export async function updateFCLRateAction(
  rateId: number,
  data: RateUpdateData,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/fcl/rates/${rateId}`, 'PATCH', data);
}

export async function updateLCLRateAction(
  rateId: number,
  data: RateUpdateData,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/lcl/rates/${rateId}`, 'PATCH', data);
}

export async function deleteFCLRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/fcl/rates/${rateId}`, 'DELETE');
}

export async function deleteLCLRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/lcl/rates/${rateId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Local Charges
// ---------------------------------------------------------------------------

export interface LocalCharge {
  id: number;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  container_size: '20' | '40' | 'ALL';
  container_type: 'GP' | 'HC' | 'RF' | 'FF' | 'OT' | 'FR' | 'PL' | 'ALL';
  dg_class_code: string;
  charge_code: string;
  description: string;
  price: number;
  cost: number;
  currency: string;
  uom: string;
  is_domestic: boolean;
  is_international: boolean;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalChargeTimeSeries {
  month_key: string;
  price: number | null;
  cost: number | null;
  rate_id: number;
}

export interface LocalChargeCard {
  card_id: number;
  card_key: string;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  container_size: '20' | '40' | 'ALL';
  container_type: 'GP' | 'HC' | 'RF' | 'FF' | 'OT' | 'FR' | 'PL' | 'ALL';
  dg_class_code: string;
  charge_code: string;
  description: string;
  uom: string;
  currency: string;
  is_domestic: boolean;
  is_international: boolean;
  is_active: boolean;
  time_series: LocalChargeTimeSeries[];
  latest_effective_from: string | null;
  latest_effective_to: string | null;
}

export async function fetchLocalChargeCardsAction(params: {
  portCode: string;
  tradeDirection?: string;
  shipmentType?: string;
  isActive?: boolean;
}): Promise<ActionResult<LocalChargeCard[]>> {
  const sp = new URLSearchParams();
  sp.set('port_code', params.portCode);
  if (params.tradeDirection) sp.set('trade_direction', params.tradeDirection);
  if (params.shipmentType) sp.set('shipment_type', params.shipmentType);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  return pricingFetch(`/api/v2/pricing/local-charges/cards?${sp.toString()}`);
}

export async function fetchLocalChargePortsAction(
  countryCode?: string
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams();
  if (countryCode) sp.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/local-charges/ports${sp.toString() ? `?${sp}` : ''}`);
}

export async function fetchLocalChargesAction(params: {
  portCode?: string;
  tradeDirection?: string;
  shipmentType?: string;
  isDomestic?: boolean;
  isActive?: boolean;
}): Promise<ActionResult<LocalCharge[]>> {
  const sp = new URLSearchParams();
  if (params.portCode) sp.set('port_code', params.portCode);
  if (params.tradeDirection) sp.set('trade_direction', params.tradeDirection);
  if (params.shipmentType) sp.set('shipment_type', params.shipmentType);
  if (params.isDomestic !== undefined) sp.set('is_domestic', String(params.isDomestic));
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/local-charges/rates${qs ? `?${qs}` : ''}`);
}

export async function createLocalChargeAction(
  data: Omit<LocalCharge, 'id' | 'created_at' | 'updated_at'> & { close_previous?: boolean },
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/local-charges/rates', 'POST', data);
}

export async function updateLocalChargeAction(
  id: number,
  data: { price?: number; cost?: number; effective_from?: string; effective_to?: string | null },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/local-charges/rates/${id}`, 'PATCH', data);
}

export async function updateLocalChargeCardAction(
  cardId: number,
  data: {
    charge_code?: string; trade_direction?: string; shipment_type?: string;
    description?: string; currency?: string; uom?: string;
    container_size?: string; container_type?: string; dg_class_code?: string;
    is_domestic?: boolean; is_international?: boolean; is_active?: boolean;
  },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/local-charges/cards/${cardId}`, 'PATCH', data);
}

export async function deleteLocalChargeAction(
  id: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/local-charges/rates/${id}`, 'DELETE');
}

export async function deleteLocalChargeCardAction(
  cardKey: string,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/local-charges/rates/card/${cardKey}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// DG Class Charges
// ---------------------------------------------------------------------------

export interface DgClassCharge {
  id: number;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  container_size: '20' | '40' | 'ALL';
  container_type: 'GP' | 'HC' | 'RF' | 'FF' | 'OT' | 'FR' | 'PL' | 'ALL';
  dg_class_code: 'DG-2' | 'DG-3';
  charge_code: string;
  description: string;
  price: number;
  cost: number;
  currency: string;
  uom: string;
  is_domestic: boolean;
  is_international: boolean;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DgClassChargeTimeSeries {
  month_key: string;
  price: number | null;
  cost: number | null;
  rate_id: number;
}

export interface DgClassChargeCard {
  card_id: number;
  card_key: string;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  container_size: '20' | '40' | 'ALL';
  container_type: 'GP' | 'HC' | 'RF' | 'FF' | 'OT' | 'FR' | 'PL' | 'ALL';
  dg_class_code: 'DG-2' | 'DG-3';
  charge_code: string;
  description: string;
  uom: string;
  currency: string;
  is_domestic: boolean;
  is_international: boolean;
  is_active: boolean;
  time_series: DgClassChargeTimeSeries[];
  latest_effective_from: string | null;
  latest_effective_to: string | null;
}

export async function fetchDgClassChargeCardsAction(params: {
  portCode: string;
  tradeDirection?: string;
  shipmentType?: string;
  isActive?: boolean;
}): Promise<ActionResult<DgClassChargeCard[]>> {
  const sp = new URLSearchParams();
  sp.set('port_code', params.portCode);
  if (params.tradeDirection) sp.set('trade_direction', params.tradeDirection);
  if (params.shipmentType) sp.set('shipment_type', params.shipmentType);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  return pricingFetch(`/api/v2/pricing/dg-class-charges/cards?${sp.toString()}`);
}

export async function fetchDgClassChargePortsAction(
  countryCode?: string
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams();
  if (countryCode) sp.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/dg-class-charges/ports${sp.toString() ? `?${sp}` : ''}`);
}

export async function createDgClassChargeAction(
  data: Omit<DgClassCharge, 'id' | 'created_at' | 'updated_at'> & { close_previous?: boolean },
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/dg-class-charges/rates', 'POST', data);
}

export async function updateDgClassChargeAction(
  id: number,
  data: { price?: number; cost?: number; effective_from?: string; effective_to?: string | null },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/dg-class-charges/rates/${id}`, 'PATCH', data);
}

export async function updateDgClassChargeCardAction(
  cardId: number,
  data: {
    charge_code?: string; trade_direction?: string; shipment_type?: string;
    description?: string; currency?: string; uom?: string;
    container_size?: string; container_type?: string; dg_class_code?: string;
    is_domestic?: boolean; is_international?: boolean; is_active?: boolean;
  },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/dg-class-charges/cards/${cardId}`, 'PATCH', data);
}

export async function deleteDgClassChargeAction(
  id: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/dg-class-charges/rates/${id}`, 'DELETE');
}

export async function deleteDgClassChargeCardAction(
  cardKey: string,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/dg-class-charges/rates/card/${cardKey}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Customs Clearance
// ---------------------------------------------------------------------------

export interface CustomsRate {
  id: number;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  charge_code: string;
  description: string;
  price: number;
  cost: number;
  currency: string;
  uom: string;
  is_domestic: boolean;
  is_international: boolean;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomsRateTimeSeries {
  month_key: string;
  price: number | null;
  cost: number | null;
  rate_id: number;
}

export interface CustomsRateCard {
  card_id: number;
  card_key: string;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  charge_code: string;
  description: string;
  uom: string;
  currency: string;
  is_domestic: boolean;
  is_international: boolean;
  is_active: boolean;
  latest_effective_from: string | null;
  latest_effective_to: string | null;
  time_series: CustomsRateTimeSeries[];
}

export async function fetchCustomsRatePortsAction(
  countryCode?: string,
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams();
  if (countryCode) sp.set('country_code', countryCode);
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/customs/ports${qs ? `?${qs}` : ''}`);
}

export async function fetchCustomsRateCardsAction(params: {
  portCode: string;
  tradeDirection?: string;
  shipmentType?: string;
  isActive?: boolean;
}): Promise<ActionResult<CustomsRateCard[]>> {
  const sp = new URLSearchParams();
  sp.set('port_code', params.portCode);
  if (params.tradeDirection) sp.set('trade_direction', params.tradeDirection);
  if (params.shipmentType) sp.set('shipment_type', params.shipmentType);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/customs/cards${qs ? `?${qs}` : ''}`);
}

export async function fetchCustomsRatesAction(params: {
  portCode?: string;
  tradeDirection?: string;
  shipmentType?: string;
  isActive?: boolean;
}): Promise<ActionResult<CustomsRate[]>> {
  const sp = new URLSearchParams();
  if (params.portCode) sp.set('port_code', params.portCode);
  if (params.tradeDirection) sp.set('trade_direction', params.tradeDirection);
  if (params.shipmentType) sp.set('shipment_type', params.shipmentType);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/customs/rates${qs ? `?${qs}` : ''}`);
}

export async function updateCustomsCardAction(
  cardId: number,
  data: {
    charge_code?: string;
    trade_direction?: string;
    shipment_type?: string;
    description?: string;
    currency?: string;
    uom?: string;
    is_domestic?: boolean;
    is_international?: boolean;
    is_active?: boolean;
  },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/customs/cards/${cardId}`, 'PATCH', data);
}

export async function createCustomsRateAction(
  data: Omit<CustomsRate, 'id' | 'created_at' | 'updated_at'> & { close_previous?: boolean },
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/customs/rates', 'POST', data);
}

export async function updateCustomsRateAction(
  id: number,
  data: {
    price?: number;
    cost?: number;
    effective_from?: string;
    effective_to?: string | null;
  },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/customs/rates/${id}`, 'PATCH', data);
}

export async function deleteCustomsRateAction(
  id: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/customs/rates/${id}`, 'DELETE');
}

export async function deleteCustomsCardAction(
  cardKey: string,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/customs/rates/card/${cardKey}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Port Transport
// ---------------------------------------------------------------------------

export interface PortTransportArea {
  area_id: number;
  area_code: string;
  area_name: string;
  port_un_code: string;
  state_code: string;
  state_name: string;
}

export interface VehicleType {
  vehicle_type_id: string;
  label: string;
  category: string;
  sort_order: number;
}

export interface PortTransportRateCard {
  id: number;
  rate_card_key: string;
  port_un_code: string;
  terminal_id: string | null;
  terminal_name: string | null;
  area_id: number;
  area_name: string;
  area_code: string;
  state_name: string | null;
  vehicle_type_id: string;
  vehicle_type_label: string;
  include_depot_gate_fee: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latest_price_ref: { list_price: number | null; currency: string; effective_from: string } | null;
  pending_draft_count: number;
  latest_list_price_from: string | null;
  latest_cost_from: string | null;
  time_series: PortTransportTimeSeries[];
  rates_by_supplier?: Record<string, PortTransportRate[]>;
}

export interface PortTransportTimeSeries {
  month_key: string;
  list_price: number | null;
  cost: number | null;
  currency: string | null;
  rate_status: string | null;
  surcharge_total: number;
  list_surcharge_total?: number;
  cost_surcharge_total?: number;
  has_surcharges: boolean;
}

export interface PortTransportRate {
  id: number;
  rate_card_id: number;
  supplier_id: string | null;
  effective_from: string;
  effective_to: string | null;
  rate_status: string;
  currency: string;
  uom: string;
  list_price: number | null;
  cost: number | null;
  min_list_price: number | null;
  min_cost: number | null;
  surcharges: SurchargeItem[] | null;
  roundup_qty: number;
  created_at: string;
  updated_at: string;
}

export async function fetchPortTransportPortsAction(
  countryCode?: string
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams({ is_active: 'true' });
  if (countryCode) sp.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/port-transport/ports?${sp.toString()}`);
}

export async function fetchPortTransportAreasAction(
  portUnCode?: string
): Promise<ActionResult<PortTransportArea[]>> {
  const sp = new URLSearchParams();
  if (portUnCode) sp.set('port_un_code', portUnCode);
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/port-transport/areas${qs ? `?${qs}` : ''}`);
}

export async function fetchPortTransportVehicleTypesAction(): Promise<ActionResult<VehicleType[]>> {
  return pricingFetch('/api/v2/pricing/port-transport/vehicle-types');
}

export async function fetchPortTransportRateCardsAction(params: {
  countryCode?: string;
  portUnCode?: string;
  areaId?: number;
  vehicleTypeId?: string;
  isActive?: boolean;
  alertsOnly?: boolean;
}): Promise<ActionResult<PortTransportRateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.portUnCode) sp.set('port_un_code', params.portUnCode);
  if (params.areaId) sp.set('area_id', String(params.areaId));
  if (params.vehicleTypeId) sp.set('vehicle_type_id', params.vehicleTypeId);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  if (params.alertsOnly) sp.set('alerts_only', 'true');
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/port-transport/rate-cards${qs ? `?${qs}` : ''}`);
}

export async function fetchPortTransportRateCardDetailAction(
  cardId: number
): Promise<ActionResult<PortTransportRateCard>> {
  return pricingFetch(`/api/v2/pricing/port-transport/rate-cards/${cardId}`);
}

export async function createPortTransportRateCardAction(
  data: { port_un_code: string; area_id: number; vehicle_type_id: string; include_depot_gate_fee?: boolean },
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/port-transport/rate-cards', 'POST', data);
}

export async function updatePortTransportRateCardAction(
  cardId: number,
  data: { include_depot_gate_fee?: boolean; is_active?: boolean },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/port-transport/rate-cards/${cardId}`, 'PATCH', data);
}

export async function fetchPortTransportRatesAction(
  cardId: number,
  supplierId?: string,
): Promise<ActionResult<PortTransportRate[]>> {
  const sp = new URLSearchParams();
  if (supplierId !== undefined) sp.set('supplier_id', supplierId);
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/port-transport/rate-cards/${cardId}/rates${qs ? `?${qs}` : ''}`);
}

export async function createPortTransportRateAction(
  cardId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate(`/api/v2/pricing/port-transport/rate-cards/${cardId}/rates`, 'POST', data);
}

export async function updatePortTransportRateAction(
  rateId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/port-transport/rates/${rateId}`, 'PATCH', data);
}

export async function publishPortTransportRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/port-transport/rates/${rateId}/publish`, 'POST');
}

export async function rejectPortTransportRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/port-transport/rates/${rateId}/reject`, 'POST');
}

export async function deletePortTransportRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/port-transport/rates/${rateId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Haulage pricing
// ---------------------------------------------------------------------------

export interface HaulageRateCard {
  id: number;
  rate_card_key: string;
  port_un_code: string;
  terminal_id: string | null;
  terminal_name: string | null;
  area_id: number;
  area_name: string;
  area_code: string;
  state_name: string | null;
  container_size: string;
  include_depot_gate_fee: boolean;
  side_loader_available: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latest_price_ref: { list_price: number | null; currency: string; effective_from: string } | null;
  pending_draft_count: number;
  latest_list_price_from: string | null;
  latest_cost_from: string | null;
  time_series: HaulageTimeSeries[];
  rates_by_supplier?: Record<string, HaulageRate[]>;
}

export interface HaulageTimeSeries {
  month_key: string;
  list_price: number | null;
  cost: number | null;
  currency: string | null;
  rate_status: string | null;
  surcharge_total: number;
  list_surcharge_total?: number;
  cost_surcharge_total?: number;
  has_surcharges: boolean;
}

export interface HaulageRate {
  id: number;
  rate_card_id: number;
  supplier_id: string | null;
  effective_from: string;
  effective_to: string | null;
  rate_status: string;
  currency: string;
  uom: string;
  list_price: number | null;
  cost: number | null;
  min_list_price: number | null;
  min_cost: number | null;
  surcharges: SurchargeItem[] | null;
  side_loader_surcharge: number | null;
  roundup_qty: number;
  created_at: string;
  updated_at: string;
}

export interface ContainerSize {
  container_size: string;
  label: string;
}

export async function fetchHaulagePortsAction(
  countryCode?: string
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams({ is_active: 'true' });
  if (countryCode) sp.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/haulage/ports?${sp.toString()}`);
}

export async function fetchHaulageAreasAction(
  portUnCode?: string
): Promise<ActionResult<PortTransportArea[]>> {
  const sp = new URLSearchParams();
  if (portUnCode) sp.set('port_un_code', portUnCode);
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/haulage/areas${qs ? `?${qs}` : ''}`);
}

export async function fetchHaulageContainerSizesAction(): Promise<ActionResult<ContainerSize[]>> {
  return pricingFetch('/api/v2/pricing/haulage/container-sizes');
}

export async function fetchHaulageRateCardsAction(params: {
  countryCode?: string;
  portUnCode?: string;
  areaId?: number;
  containerSize?: string;
  isActive?: boolean;
  alertsOnly?: boolean;
}): Promise<ActionResult<HaulageRateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.portUnCode) sp.set('port_un_code', params.portUnCode);
  if (params.areaId) sp.set('area_id', String(params.areaId));
  if (params.containerSize) sp.set('container_size', params.containerSize);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  if (params.alertsOnly) sp.set('alerts_only', 'true');
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/haulage/rate-cards${qs ? `?${qs}` : ''}`);
}

export async function fetchHaulageRateCardDetailAction(
  cardId: number
): Promise<ActionResult<HaulageRateCard>> {
  return pricingFetch(`/api/v2/pricing/haulage/rate-cards/${cardId}`);
}

export async function createHaulageRateCardAction(
  data: { port_un_code: string; area_id: number; container_size: string; include_depot_gate_fee?: boolean; side_loader_available?: boolean },
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/haulage/rate-cards', 'POST', data);
}

export async function updateHaulageRateCardAction(
  cardId: number,
  data: { include_depot_gate_fee?: boolean; side_loader_available?: boolean; is_active?: boolean },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/rate-cards/${cardId}`, 'PATCH', data);
}

export async function fetchHaulageRatesAction(
  cardId: number,
  supplierId?: string,
): Promise<ActionResult<HaulageRate[]>> {
  const sp = new URLSearchParams();
  if (supplierId !== undefined) sp.set('supplier_id', supplierId);
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/haulage/rate-cards/${cardId}/rates${qs ? `?${qs}` : ''}`);
}

export async function createHaulageRateAction(
  cardId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate(`/api/v2/pricing/haulage/rate-cards/${cardId}/rates`, 'POST', data);
}

export async function updateHaulageRateAction(
  rateId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/rates/${rateId}`, 'PATCH', data);
}

export async function publishHaulageRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/rates/${rateId}/publish`, 'POST');
}

export async function rejectHaulageRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/rates/${rateId}/reject`, 'POST');
}

export async function deleteHaulageRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/rates/${rateId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Depot Gate Fees (DGF)
// ---------------------------------------------------------------------------

export interface DepotGateFee {
  id: number;
  port_un_code: string;
  terminal_id: string | null;
  effective_from: string;
  effective_to: string | null;
  rate_status: string;
  currency: string;
  fee_amount: number;
  created_at: string;
  updated_at: string;
}

export async function fetchDepotGateFeesAction(
  portUnCode: string,
  terminalId?: string,
): Promise<ActionResult<DepotGateFee[]>> {
  const sp = new URLSearchParams({ port_un_code: portUnCode });
  if (terminalId) sp.set('terminal_id', terminalId);
  return pricingFetch(`/api/v2/pricing/haulage/depot-gate-fees?${sp.toString()}`);
}

export async function fetchActiveDepotGateFeeAction(
  portUnCode: string,
  terminalId?: string,
): Promise<ActionResult<DepotGateFee | null>> {
  const sp = new URLSearchParams({ port_un_code: portUnCode });
  if (terminalId) sp.set('terminal_id', terminalId);
  return pricingFetch(`/api/v2/pricing/haulage/depot-gate-fees/active?${sp.toString()}`);
}

export async function createDepotGateFeeAction(
  data: Record<string, unknown>,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/haulage/depot-gate-fees', 'POST', data);
}

export async function updateDepotGateFeeAction(
  feeId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/depot-gate-fees/${feeId}`, 'PATCH', data);
}

export async function deleteDepotGateFeeAction(
  feeId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/haulage/depot-gate-fees/${feeId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Haulage Supplier Rebates
// ---------------------------------------------------------------------------

export interface HaulageSupplierRebate {
  id: number;
  supplier_id: string;
  port_un_code: string;
  container_size: string; // '20' | '40' | '40HC' | 'side_loader_20' | 'side_loader_40' | 'side_loader_40HC'
  effective_from: string;
  effective_to: string | null;
  rate_status: string;
  rebate_percent: number; // e.g. 0.075 = 7.5%
  created_at: string;
  updated_at: string;
}

export async function fetchHaulageSupplierRebatesAction(
  supplierId: string,
): Promise<ActionResult<HaulageSupplierRebate[]>> {
  const sp = new URLSearchParams({ supplier_id: supplierId });
  return pricingFetch(`/api/v2/pricing/haulage/supplier-rebates?${sp.toString()}`);
}

export async function createHaulageSupplierRebateAction(
  data: Record<string, unknown>,
): Promise<ActionResult<HaulageSupplierRebate>> {
  return pricingMutate('/api/v2/pricing/haulage/supplier-rebates', 'POST', data);
}

export async function updateHaulageSupplierRebateAction(
  rebateId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<HaulageSupplierRebate>> {
  return pricingMutate(`/api/v2/pricing/haulage/supplier-rebates/${rebateId}`, 'PATCH', data);
}

export async function deleteHaulageSupplierRebateAction(
  rebateId: number,
): Promise<ActionResult<{ deleted: boolean }>> {
  return pricingMutate(`/api/v2/pricing/haulage/supplier-rebates/${rebateId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Haulage FAF Rates
// ---------------------------------------------------------------------------

export interface FafPortRate {
  port_un_code: string;
  container_size: string; // '20' | '40' | '40HC' | 'wildcard'
  faf_percent: number; // e.g. 0.05 = 5%
}

export interface HaulageFafRate {
  id: number;
  supplier_id: string;
  effective_from: string;
  effective_to: string | null;
  rate_status: string;
  port_rates: FafPortRate[];
  created_at: string;
  updated_at: string;
}

export async function fetchHaulageFafRatesAction(
  supplierId: string,
): Promise<ActionResult<HaulageFafRate[]>> {
  const sp = new URLSearchParams({ supplier_id: supplierId });
  return pricingFetch(`/api/v2/pricing/haulage/faf-rates?${sp.toString()}`);
}

export async function createHaulageFafRateAction(
  data: Record<string, unknown>,
): Promise<ActionResult<HaulageFafRate>> {
  return pricingMutate('/api/v2/pricing/haulage/faf-rates', 'POST', data);
}

export async function updateHaulageFafRateAction(
  fafId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<HaulageFafRate>> {
  return pricingMutate(`/api/v2/pricing/haulage/faf-rates/${fafId}`, 'PATCH', data);
}

export async function deleteHaulageFafRateAction(
  fafId: number,
): Promise<ActionResult<{ deleted: boolean }>> {
  return pricingMutate(`/api/v2/pricing/haulage/faf-rates/${fafId}`, 'DELETE');
}

// ---------------------------------------------------------------------------
// Air Freight
// ---------------------------------------------------------------------------

export interface AirRateCard {
  id: number;
  rate_card_key: string;
  origin_port_code: string;
  destination_port_code: string;
  dg_class_code: string;
  airline_code: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latest_price_ref?: {
    l45_list_price: number | null;
    currency: string;
    effective_from: string;
  } | null;
  pending_draft_count?: number;
  time_series?: AirTimeSeries[];
  rates_by_supplier?: Record<string, AirRate[]>;
  list_price_card_id?: number | null;
  list_price_rates?: AirListPriceRate[];
  latest_list_price_from?: string | null;
  latest_cost_from?: string | null;
  latest_cost_supplier_id?: string | null;
}

export interface AirTimeSeries {
  month_key: string;
  l45_list_price: number | null;
  l45_cost: number | null;
  p100_list_price: number | null;
  p100_cost: number | null;
  currency: string | null;
  rate_status: string | null;
  list_surcharge_total: number;
  cost_surcharge_total: number;
  has_surcharges: boolean;
}

export interface AirRate {
  id: number;
  rate_card_id: number;
  supplier_id: string | null;
  effective_from: string | null;
  effective_to: string | null;
  rate_status: string;
  currency: string;
  l45_list_price: number | null;
  p45_list_price: number | null;
  p100_list_price: number | null;
  p250_list_price: number | null;
  p300_list_price: number | null;
  p500_list_price: number | null;
  p1000_list_price: number | null;
  min_list_price: number | null;
  l45_cost: number | null;
  p45_cost: number | null;
  p100_cost: number | null;
  p250_cost: number | null;
  p300_cost: number | null;
  p500_cost: number | null;
  p1000_cost: number | null;
  min_cost: number | null;
  surcharges: SurchargeItem[] | null;
  created_at: string;
  updated_at: string;
}

export interface AirListPriceRate {
  id: number;
  rate_card_id: number;
  effective_from: string | null;
  effective_to: string | null;
  rate_status: string;
  currency: string;
  l45_list_price: number | null;
  p45_list_price: number | null;
  p100_list_price: number | null;
  p250_list_price: number | null;
  p300_list_price: number | null;
  p500_list_price: number | null;
  p1000_list_price: number | null;
  min_list_price: number | null;
  surcharges: SurchargeItem[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AirResolveResult {
  rate_id: number;
  rate_card_id: number;
  supplier_id: string | null;
  chargeable_weight: number;
  reference_date: string;
  currency: string;
  tier_applied: string;
  tier_rate: number;
  min_rate: number | null;
  min_applied: boolean;
  surcharge_total_per_kg: number;
  surcharge_amount: number;
  surcharges: SurchargeItem[];
  base_charge: number;
  total_charge: number;
}

export type LCLResolveResult = {
  rate_id: number;
  rate_card_id: number;
  supplier_id: string | null;
  quantity: number;
  billable_quantity: number;
  effective_quantity: number;
  reference_date: string;
  currency: string;
  uom: string;
  rate_per_unit: number;
  min_quantity: number | null;
  min_applied: boolean;
  roundup_qty: number;
  surcharge_total_per_unit: number;
  surcharge_amount: number;
  surcharges: Array<{ code: string; description: string; amount: number }> | null;
  base_charge: number;
  total_charge: number;
};

export async function fetchAirOriginsAction(
  countryCode?: string,
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams({ is_active: 'true' });
  if (countryCode) sp.set('country_code', countryCode);
  return pricingFetch(`/api/v2/pricing/air/origins?${sp.toString()}`);
}

export async function fetchAirAirlinesAction(
  originPortCode?: string,
): Promise<ActionResult<string[]>> {
  const sp = new URLSearchParams({ is_active: 'true' });
  if (originPortCode) sp.set('origin_port_code', originPortCode);
  return pricingFetch(`/api/v2/pricing/air/airlines?${sp.toString()}`);
}

export async function fetchAirRateCardsAction(params: {
  originPortCode?: string;
  destinationPortCode?: string;
  airlineCode?: string;
  dgClassCode?: string;
  countryCode?: string;
  isActive?: boolean;
  alertsOnly?: boolean;
}): Promise<ActionResult<AirRateCard[]>> {
  const sp = new URLSearchParams();
  if (params.countryCode) sp.set('country_code', params.countryCode);
  if (params.originPortCode) sp.set('origin_port_code', params.originPortCode);
  if (params.destinationPortCode) sp.set('destination_port_code', params.destinationPortCode);
  if (params.airlineCode) sp.set('airline_code', params.airlineCode);
  if (params.dgClassCode) sp.set('dg_class_code', params.dgClassCode);
  if (params.isActive !== undefined) sp.set('is_active', String(params.isActive));
  if (params.alertsOnly) sp.set('alerts_only', 'true');
  const qs = sp.toString();
  return pricingFetch(`/api/v2/pricing/air/rate-cards${qs ? `?${qs}` : ''}`);
}

export async function fetchAirRateCardDetailAction(
  cardId: number,
): Promise<ActionResult<AirRateCard>> {
  return pricingFetch(`/api/v2/pricing/air/rate-cards/${cardId}`);
}

export async function createAirRateCardAction(
  data: Record<string, unknown>,
): Promise<ActionResult<AirRateCard>> {
  return pricingMutate('/api/v2/pricing/air/rate-cards', 'POST', data);
}

export async function updateAirRateCardAction(
  cardId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/rate-cards/${cardId}`, 'PATCH', data);
}

export async function createAirRateAction(
  cardId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate(`/api/v2/pricing/air/rate-cards/${cardId}/rates`, 'POST', data);
}

export async function updateAirRateAction(
  rateId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/rates/${rateId}`, 'PATCH', data);
}

export async function deleteAirRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/rates/${rateId}`, 'DELETE');
}

export async function publishAirRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/rates/${rateId}/publish`, 'POST');
}

export async function rejectAirRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/rates/${rateId}/reject`, 'POST');
}

// ---------------------------------------------------------------------------
// Air List Price Rate CRUD
// ---------------------------------------------------------------------------

export async function createAirListPriceCardAction(
  data: { origin_port_code: string; destination_port_code: string; dg_class_code: string },
): Promise<ActionResult<{ id: number; rate_card_key: string }>> {
  return pricingMutate('/api/v2/pricing/air/list-price-cards', 'POST', data);
}

export async function createAirListPriceRateAction(
  cardId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate(`/api/v2/pricing/air/list-price-cards/${cardId}/rates`, 'POST', data);
}

export async function updateAirListPriceRateAction(
  rateId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/list-price-rates/${rateId}`, 'PATCH', data);
}

export async function deleteAirListPriceRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/list-price-rates/${rateId}`, 'DELETE');
}

export async function publishAirListPriceRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/air/list-price-rates/${rateId}/publish`, 'POST');
}

export async function resolveAirRateAction(
  cardId: number,
  data: { chargeable_weight: number; supplier_id: string | null; reference_date?: string },
): Promise<ActionResult<AirResolveResult>> {
  return pricingMutate(`/api/v2/pricing/air/rate-cards/${cardId}/resolve`, 'POST', data);
}

export async function resolveLCLRateAction(
  cardId: number,
  data: { quantity: number; supplier_id: string | null; reference_date?: string },
): Promise<ActionResult<LCLResolveResult>> {
  return pricingMutate(`/api/v2/pricing/lcl/rate-cards/${cardId}/resolve`, 'POST', data);
}

// ---------------------------------------------------------------------------
// Currency Rates
// ---------------------------------------------------------------------------

export interface CurrencyPair {
  base_currency: string;
  target_currency: string;
  current_rate: number | null;
  current_effective_from: string | null;
}

export interface CurrencyRate {
  id: number;
  base_currency: string;
  target_currency: string;
  rate: number;
  effective_from: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchCurrencyPairsAction(): Promise<ActionResult<CurrencyPair[]>> {
  return pricingFetch('/api/v2/pricing/currency/pairs');
}

export async function fetchCurrencyRatesAction(
  base: string,
  target: string,
): Promise<ActionResult<CurrencyRate[]>> {
  return pricingFetch(`/api/v2/pricing/currency/${base}/${target}/rates`);
}

export async function upsertCurrencyRateAction(
  base: string,
  target: string,
  data: { rate: number; week_of: string; notes?: string },
): Promise<ActionResult<{ id: number; effective_from: string }>> {
  return pricingMutate(`/api/v2/pricing/currency/${base}/${target}/rates`, 'POST', data);
}

export async function deleteCurrencyRateAction(
  rateId: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/currency/rates/${rateId}`, 'DELETE');
}

export async function createCurrencyPairAction(
  data: { base_currency: string; target_currency: string },
): Promise<ActionResult<{ id: number; base_currency: string; target_currency: string }>> {
  return pricingMutate('/api/v2/pricing/currency/pairs', 'POST', data);
}

// --- Currency pair series types ---
export interface CurrencyWeekBucket {
  week_key: string;
  week_monday: string;
  raw_rate: number | null;
  effective_rate: number | null;
  rate_id: number | null;
}

export interface CurrencyPairWithSeries extends CurrencyPair {
  pair_id: number | null;
  adjustment_pct: number;
  is_active: boolean;
  time_series: CurrencyWeekBucket[];
}

// --- New/updated actions ---
export async function fetchCurrencyPairsWithSeriesAction(
  weeks?: number,
): Promise<ActionResult<CurrencyPairWithSeries[]>> {
  const q = weeks ? `?weeks=${weeks}` : '';
  return pricingFetch(`/api/v2/pricing/currency/pairs-with-series${q}`);
}

export async function updateCurrencyPairAction(
  pairId: number,
  data: { adjustment_pct?: number; is_active?: boolean; notes?: string },
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/currency/pairs/${pairId}`, 'PATCH', data);
}

export interface RhbFetchResult {
  updated: number;
  skipped: number;
  skipped_pairs: string[];
  rhb_timestamp: string;
  effective_from: string;
}

export async function fetchRhbRatesAction(): Promise<ActionResult<RhbFetchResult>> {
  return pricingMutate('/api/v2/pricing/currency/fetch-rhb', 'POST');
}
