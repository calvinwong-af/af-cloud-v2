/**
 * RETIRED — this route has moved to /orders/deliveries
 * This file exists only to hard-redirect any stale links.
 * Safe to delete once confirmed no external links point here.
 */

import { redirect } from 'next/navigation';

export default function RetiredGroundTransportPage() {
  redirect('/orders/deliveries');
}
