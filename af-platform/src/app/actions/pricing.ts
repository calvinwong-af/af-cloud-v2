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
  charge_code: string;
  description: string;
  price: number;
  cost: number;
  currency: string;
  uom: string;
  is_domestic: boolean;
  paid_with_freight: boolean;
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
  card_key: string;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  container_size: '20' | '40' | 'ALL';
  container_type: 'GP' | 'HC' | 'RF' | 'FF' | 'OT' | 'FR' | 'PL' | 'ALL';
  charge_code: string;
  description: string;
  uom: string;
  currency: string;
  is_domestic: boolean;
  paid_with_freight: boolean;
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
  data: Partial<LocalCharge>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/local-charges/rates/${id}`, 'PATCH', data);
}

export async function deleteLocalChargeAction(
  id: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/local-charges/rates/${id}`, 'DELETE');
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
  card_key: string;
  port_code: string;
  trade_direction: 'IMPORT' | 'EXPORT';
  shipment_type: 'FCL' | 'LCL' | 'AIR' | 'CB' | 'ALL';
  charge_code: string;
  description: string;
  uom: string;
  currency: string;
  is_domestic: boolean;
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

export async function createCustomsRateAction(
  data: Omit<CustomsRate, 'id' | 'created_at' | 'updated_at'> & { close_previous?: boolean },
): Promise<ActionResult<{ id: number }>> {
  return pricingMutate('/api/v2/pricing/customs/rates', 'POST', data);
}

export async function updateCustomsRateAction(
  id: number,
  data: Partial<CustomsRate>,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/customs/rates/${id}`, 'PATCH', data);
}

export async function deleteCustomsRateAction(
  id: number,
): Promise<ActionResult<{ msg: string }>> {
  return pricingMutate(`/api/v2/pricing/customs/rates/${id}`, 'DELETE');
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
  area_id: number;
  area_name: string;
  area_code: string;
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
