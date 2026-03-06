'use server';
/**
 * Geography Server Actions — states, cities, areas, port resolution.
 */

import { verifySessionAndRole } from '@/lib/auth-server';
import { fetchStates, fetchCities, fetchAreas, fetchGeoPorts } from '@/lib/geography';
import type { State, City, Area } from '@/lib/types';
import type { Port } from '@/lib/ports';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface Country {
  country_code: string;
  name: string;
  currency_code: string | null;
  tax_label: string | null;
  tax_rate: number | null;
  tax_applicable: boolean;
  is_active: boolean;
}

async function getToken(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = cookies();
  return cookieStore.get('af-session')?.value ?? null;
}

// ---------------------------------------------------------------------------
// Read actions (any authenticated user)
// ---------------------------------------------------------------------------

export async function fetchStatesAction(): Promise<ActionResult<State[]>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };
    const data = await fetchStates(token);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch states' };
  }
}

export async function fetchCitiesAction(stateCode?: string): Promise<ActionResult<City[]>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };
    const data = await fetchCities(token, stateCode);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch cities' };
  }
}

export async function fetchAreasAction(
  filters?: { port_un_code?: string; state_code?: string }
): Promise<ActionResult<Area[]>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };
    const data = await fetchAreas(token, filters);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch areas' };
  }
}

export async function fetchGeoPortsAction(): Promise<ActionResult<Port[]>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };
    const data = await fetchGeoPorts(token);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch ports' };
  }
}

// ---------------------------------------------------------------------------
// Write actions (AFU only)
// ---------------------------------------------------------------------------

async function afuWriteAction<T>(
  path: string,
  method: string,
  body?: Record<string, unknown>
): Promise<ActionResult<T>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised — staff only' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };

    const url = new URL(path, process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
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

// Cities
export async function createCityAction(data: { name: string; state_code: string; lat?: number | null; lng?: number | null }) {
  return afuWriteAction('/api/v2/geography/cities', 'POST', data);
}

export async function updateCityAction(cityId: number, data: { name?: string; is_active?: boolean; lat?: number | null; lng?: number | null }) {
  return afuWriteAction(`/api/v2/geography/cities/${cityId}`, 'PATCH', data);
}

// Areas
export async function createAreaAction(data: {
  area_code: string; area_name: string; port_un_code: string;
  state_code?: string | null; city_id?: number | null; lat?: number | null; lng?: number | null;
}) {
  return afuWriteAction('/api/v2/geography/areas', 'POST', data);
}

export async function updateAreaAction(areaId: number, data: Record<string, unknown>) {
  return afuWriteAction(`/api/v2/geography/areas/${areaId}`, 'PATCH', data);
}

export async function deleteAreaAction(areaId: number) {
  return afuWriteAction(`/api/v2/geography/areas/${areaId}`, 'DELETE');
}

// Ports — coordinate update
export async function updatePortCoordinatesAction(unCode: string, data: { lat?: number | null; lng?: number | null }) {
  return afuWriteAction(`/api/v2/geography/ports/${encodeURIComponent(unCode)}`, 'PATCH', data);
}

// Port resolution
export async function resolvePortAction(code: string): Promise<ActionResult<{
  already_exists: boolean;
  candidate: {
    un_code: string; name: string; country: string; country_code: string;
    port_type: string; lat: number | null; lng: number | null; confidence: string;
  };
}>> {
  try {
    const session = await verifySessionAndRole(['AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised — staff only' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };

    const url = new URL('/api/v2/geography/ports/resolve', process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Server responded ${res.status}: ${text}` };
    }

    const json = await res.json();
    return { success: true, data: { already_exists: json.already_exists, candidate: json.candidate } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Port resolution failed' };
  }
}

export async function confirmPortAction(data: {
  un_code: string; name: string; country: string; country_code: string;
  port_type: string; lat?: number | null; lng?: number | null;
}) {
  return afuWriteAction('/api/v2/geography/ports/confirm', 'POST', data);
}

// Countries
export async function fetchCountriesAction(): Promise<ActionResult<Country[]>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };
    const token = await getToken();
    if (!token) return { success: false, error: 'No session token' };

    const url = new URL('/api/v2/geography/countries', process.env.AF_SERVER_URL);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Server responded ${res.status}: ${text}` };
    }

    const json = await res.json();
    return { success: true, data: json.data ?? [] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch countries' };
  }
}

export async function updateCountryAction(
  countryCode: string,
  data: {
    currency_code?: string | null;
    tax_label?: string | null;
    tax_rate?: number | null;
    tax_applicable?: boolean;
  }
): Promise<ActionResult<void>> {
  return afuWriteAction(`/api/v2/geography/countries/${encodeURIComponent(countryCode)}`, 'PATCH', data as Record<string, unknown>);
}
