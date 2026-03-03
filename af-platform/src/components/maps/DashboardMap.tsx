'use client';

import { useState } from 'react';
import { Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import MapProvider, { isMapAvailable } from './MapProvider';
import { MapPin } from 'lucide-react';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLOR } from '@/lib/types';

export interface ShipmentMapMarker {
  shipment_id: string;
  company_name: string;
  status: number;
  lat: number;
  lng: number;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  gray: '#9ca3af',
  yellow: '#eab308',
  blue: '#3b82f6',
  orange: '#f97316',
  teal: '#14b8a6',
  sky: '#0ea5e9',
  indigo: '#6366f1',
  green: '#22c55e',
  amber: '#f59e0b',
};

function MapPlaceholder({ height, message }: { height: string; message: string }) {
  return (
    <div style={{ height }} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center justify-center text-sm text-[var(--text-muted)] gap-2">
      <MapPin className="w-6 h-6" />
      <span>{message}</span>
    </div>
  );
}

export default function DashboardMap({ markers, height = '400px' }: {
  markers: ShipmentMapMarker[];
  height?: string;
}) {
  const [selectedMarker, setSelectedMarker] = useState<ShipmentMapMarker | null>(null);

  if (!isMapAvailable()) {
    return <MapPlaceholder height={height} message="Map unavailable" />;
  }

  if (markers.length === 0) {
    return <MapPlaceholder height={height} message="No shipment locations available yet" />;
  }

  // Center on Malaysia by default
  const defaultCenter = { lat: 4.2, lng: 108.0 };

  return (
    <MapProvider>
      <div style={{ height }} className="rounded-xl overflow-hidden border border-[var(--border)]">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={5}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          mapId="dashboard-map"
        >
          {markers.map((m) => {
            const color = STATUS_DOT_COLORS[SHIPMENT_STATUS_COLOR[m.status] || 'gray'] || '#9ca3af';
            return (
              <AdvancedMarker
                key={m.shipment_id}
                position={{ lat: m.lat, lng: m.lng }}
                onClick={() => setSelectedMarker(m)}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-white shadow cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              </AdvancedMarker>
            );
          })}

          {selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="text-xs space-y-1 min-w-[150px]">
                <p className="font-semibold text-gray-900">{selectedMarker.shipment_id}</p>
                <p className="text-gray-600">{selectedMarker.company_name}</p>
                <p className="text-gray-500">{SHIPMENT_STATUS_LABELS[selectedMarker.status] || 'Unknown'}</p>
                <a
                  href={`/shipments/${selectedMarker.shipment_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline block mt-1"
                >
                  View shipment →
                </a>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>
    </MapProvider>
  );
}
