'use server';
/**
 * AcceleFreight Platform — ShipmentOrders Server Actions
 *
 * Server-side only. Enforces auth + RBAC.
 * Read-only for now — write (create/update) actions come in the next phase.
 */

import { getShipmentOrders, getShipmentOrderDetail, getShipmentOrderStats } from '@/lib/shipments';
import { verifySessionAndRole, logAction } from '@/lib/auth-server';
import type { ShipmentOrder, OrderType, ShipmentOrderStatus } from '@/lib/types';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function fetchShipmentOrdersAction(options?: {
  companyId?: string;
  status?: ShipmentOrderStatus[];
  orderType?: OrderType[];
  limit?: number;
  cursor?: string;
}): Promise<ActionResult<{ orders: ShipmentOrder[]; nextCursor: string | null }>> {
  try {
    // AFC staff and Admin can see all orders
    // AFU users can only see their own company's orders (enforced by companyId check below)
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    // AFC and AFU-ADMIN (internal staff) can see all orders
    // AFU customers are scoped to their own company only
    let companyId = options?.companyId;
    const isCustomer = session.account_type === 'AFC';
    if (isCustomer) {
      if (!session.company_id) {
        return { success: false, error: 'No company associated with this account' };
      }
      companyId = session.company_id;
    }

    const result = await getShipmentOrders({
      companyId,
      status: options?.status,
      orderType: options?.orderType,
      limit: options?.limit ?? 50,
      cursor: options?.cursor,
      excludeTrash: true,
      excludeChildren: true,
    });

    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchShipmentOrdersAction]', message);
    return { success: false, error: 'Failed to load shipment orders. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export async function fetchShipmentOrderDetailAction(
  quotationId: string
): Promise<ActionResult<ShipmentOrder>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    if (!quotationId?.match(/^AFCQ-\d+$/)) {
      return { success: false, error: 'Invalid shipment order ID format' };
    }

    const order = await getShipmentOrderDetail(quotationId);
    if (!order) {
      return { success: false, error: `Shipment order ${quotationId} not found` };
    }

    // AFC customers can only see their own company's orders
    if (session.account_type === 'AFC' && order.company_id !== session.company_id) {
      return { success: false, error: 'Not found' };  // Don't reveal it exists
    }

    await logAction({
      uid: session.uid,
      email: session.email,
      account_type: session.account_type,
      action: 'SHIPMENT_ORDER_VIEW',
      entity_kind: 'Quotation',
      entity_id: quotationId,
      success: true,
    });

    return { success: true, data: order };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchShipmentOrderDetailAction]', message);
    return { success: false, error: 'Failed to load shipment order. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Stats (dashboard)
// ---------------------------------------------------------------------------

export async function fetchShipmentOrderStatsAction(
  companyId?: string
): Promise<ActionResult<{
  total: number;
  active: number;
  completed: number;
  draft: number;
  cancelled: number;
}>> {
  try {
    const session = await verifySessionAndRole(['AFC-ADMIN', 'AFC-M', 'AFU-ADMIN']);
    if (!session.valid) {
      return { success: false, error: 'Unauthorised' };
    }

    // AFC customers: scope to own company
    const scopedCompanyId =
      session.account_type === 'AFC' ? session.company_id ?? undefined : companyId;

    const stats = await getShipmentOrderStats(scopedCompanyId);
    return { success: true, data: stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[fetchShipmentOrderStatsAction]', message);
    return { success: false, error: 'Failed to load stats.' };
  }
}
