/**
 * RETIRED — this route has moved to /orders/shipments
 * This file exists only to hard-redirect any stale links.
 * Safe to delete once confirmed no external links point here.
 */

import { redirect } from 'next/navigation';

export default function RetiredShipmentsPage() {
  redirect('/orders/shipments');
}
