'use server';

import { verifySessionAndRole } from '@/lib/auth-server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderListItem {
  order_id: string;
  order_type: 'shipment' | 'transport';
  transport_type: string | null;
  order_type_detail: string | null;
  transaction_type: string | null;
  origin_port: string | null;
  dest_port: string | null;
  status: string;
  sub_status: string | null;
  company_id: string;
  company_name: string;
  parent_shipment_id: string | null;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderStats {
  active: number;
  cancelled: number;
  total: number;
}

// ---------------------------------------------------------------------------
// List Orders
// ---------------------------------------------------------------------------

export async function listOrdersAction(
  tab: string = 'active',
  offset: number = 0,
  limit: number = 25,
): Promise<{
  items: OrderListItem[];
  next_cursor: string | null;
  total: number;
}> {
  const empty = { items: [], next_cursor: null, total: 0 };

  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return empty;

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return empty;

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return empty;

    const url = new URL('/api/v2/orders', serverUrl);
    url.searchParams.set('tab', tab);
    url.searchParams.set('limit', String(limit));
    if (offset > 0) {
      url.searchParams.set('offset', String(offset));
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[listOrdersAction] af-server responded', res.status);
      return empty;
    }

    const json = await res.json();
    return {
      items: json.items ?? [],
      next_cursor: json.next_cursor ?? null,
      total: json.total ?? 0,
    };
  } catch (err) {
    console.error('[listOrdersAction]', err instanceof Error ? err.message : err);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Order Stats
// ---------------------------------------------------------------------------

export async function fetchOrderStatsAction(): Promise<
  { success: true; data: OrderStats } | { success: false; error: string }
> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN', 'AFU-STAFF']);
    if (!session.valid) return { success: false, error: 'Unauthorised' };

    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const idToken = cookieStore.get('af-session')?.value;
    if (!idToken) return { success: false, error: 'No session token' };

    const serverUrl = process.env.AF_SERVER_URL;
    if (!serverUrl) return { success: false, error: 'Server URL not configured' };

    const res = await fetch(`${serverUrl}/api/v2/orders/stats`, {
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      return { success: false, error: json?.detail ?? `Server responded ${res.status}` };
    }

    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err) {
    console.error('[fetchOrderStatsAction]', err instanceof Error ? err.message : err);
    return { success: false, error: 'Failed to fetch order stats' };
  }
}
