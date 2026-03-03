/**
 * Geography data access — states, cities, haulage areas.
 * Follows the same fetch+auth pattern as lib/shipments.ts.
 */

import type { State, City, HaulageArea } from './types';
import type { Port } from './ports';

const BASE = process.env.AF_SERVER_URL || '';

async function geoFetch<T>(path: string, token: string): Promise<T[]> {
  const url = new URL(path, BASE);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchStates(token: string): Promise<State[]> {
  return geoFetch<State>('/api/v2/geography/states', token);
}

export async function fetchCities(token: string, stateCode?: string): Promise<City[]> {
  const path = stateCode
    ? `/api/v2/geography/cities?state_code=${encodeURIComponent(stateCode)}`
    : '/api/v2/geography/cities';
  return geoFetch<City>(path, token);
}

export async function fetchHaulageAreas(
  token: string,
  filters?: { port_un_code?: string; state_code?: string }
): Promise<HaulageArea[]> {
  const params = new URLSearchParams();
  if (filters?.port_un_code) params.set('port_un_code', filters.port_un_code);
  if (filters?.state_code) params.set('state_code', filters.state_code);
  const qs = params.toString();
  const path = qs ? `/api/v2/geography/haulage-areas?${qs}` : '/api/v2/geography/haulage-areas';
  return geoFetch<HaulageArea>(path, token);
}

export async function fetchGeoPorts(token: string): Promise<Port[]> {
  return geoFetch<Port>('/api/v2/geography/ports', token);
}
