/**
 * AcceleFreight Platform — Shipment Order Write Operations (V2)
 *
 * Most write operations now go through af-server endpoints.
 * This file retains shared result types and the legacy updateInvoicedStatus function.
 */

import { getDatastore } from './datastore-query';
import { logAction } from './auth-server';

// ---------------------------------------------------------------------------
// Result types (used by actions/shipments-write.ts)
// ---------------------------------------------------------------------------

export type CreateShipmentOrderResult =
  | { success: true; shipment_id: string; tracking_id: string }
  | { success: false; error: string };

export type DeleteShipmentOrderResult =
  | { success: true }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Update Invoiced Status
// @deprecated — use PATCH /api/v2/shipments/{id}/invoiced via af-server
// ---------------------------------------------------------------------------

export interface UpdateInvoicedStatusInput {
  shipment_id: string;
  issued_invoice: boolean;
  changed_by_uid: string;
  changed_by_email: string;
}

export type UpdateInvoicedStatusResult =
  | { success: true }
  | { success: false; error: string };

export async function updateInvoicedStatus(
  input: UpdateInvoicedStatusInput
): Promise<UpdateInvoicedStatusResult> {
  try {
    const ds = getDatastore();
    const now = new Date().toISOString();

    const quotationKey = ds.key(['Quotation', input.shipment_id]);

    await ds.merge({
      key: quotationKey,
      data: {
        issued_invoice: input.issued_invoice,
        updated: now,
      },
    });

    // V1 dual-write: also update ShipmentOrder so server-side stats/list stay consistent
    if (input.shipment_id.startsWith('AFCQ-')) {
      try {
        const soKey = ds.key(['ShipmentOrder', input.shipment_id]);
        await ds.merge({
          key: soKey,
          data: { issued_invoice: input.issued_invoice, updated: now },
        });
      } catch (soErr) {
        console.warn('[updateInvoicedStatus] Could not write to ShipmentOrder:', soErr);
      }
    }

    await logAction({
      uid: input.changed_by_uid,
      email: input.changed_by_email,
      account_type: 'AFU',
      action: 'UPDATE_INVOICED_STATUS',
      entity_kind: 'Quotation',
      entity_id: input.shipment_id,
      success: true,
      meta: { issued_invoice: input.issued_invoice },
    });

    return { success: true };
  } catch (err) {
    console.error('[updateInvoicedStatus] Failed:', err);

    await logAction({
      uid: input.changed_by_uid,
      email: input.changed_by_email,
      account_type: 'AFU',
      action: 'UPDATE_INVOICED_STATUS',
      entity_kind: 'Quotation',
      entity_id: input.shipment_id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      meta: { issued_invoice: input.issued_invoice },
    });

    return { success: false, error: 'Failed to update invoiced status. Please try again.' };
  }
}
