'use client';

import { useMemo } from 'react';
import type { ShipmentOrder } from '@/lib/types';
import type { Port } from '@/lib/ports';
import RouteMap from './RouteMap';
import { MapPin } from 'lucide-react';

interface Props {
  order: ShipmentOrder;
  ports: Port[];
}

export default function ShipmentRouteMapCard({ order, ports }: Props) {
  const mapData = useMemo(() => {
    const originCode = order.origin?.port_un_code;
    const destCode = order.destination?.port_un_code;
    if (!originCode || !destCode) return null;

    const originPort = ports.find((p) => p.un_code === originCode);
    const destPort = ports.find((p) => p.un_code === destCode);
    if (!originPort?.lat || !originPort?.lng || !destPort?.lat || !destPort?.lng) return null;

    return {
      origin: { lat: originPort.lat, lng: originPort.lng, label: originPort.name },
      destination: { lat: destPort.lat, lng: destPort.lng, label: destPort.name },
    };
  }, [order, ports]);

  // Don't render anything if we can't show a map
  if (!mapData) {
    if (!order.origin?.port_un_code || !order.destination?.port_un_code) return null;
    return (
      <div className="bg-white rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Route Map</h3>
        </div>
        <div className="h-[200px] rounded-lg bg-[var(--surface)] flex items-center justify-center text-xs text-[var(--text-muted)]">
          Map unavailable — port coordinates not set
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-[var(--text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--text)]">Route Map</h3>
      </div>
      <RouteMap origin={mapData.origin} destination={mapData.destination} height="250px" />
    </div>
  );
}
