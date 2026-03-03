'use client';

import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import MapProvider, { isMapAvailable } from './MapProvider';
import { MapPin } from 'lucide-react';

interface PortMarkerMapProps {
  lat: number;
  lng: number;
  height?: string;
}

function MapPlaceholder({ lat, lng, height }: { lat: number; lng: number; height: string }) {
  return (
    <div style={{ height }} className="rounded-lg bg-[var(--surface)] flex flex-col items-center justify-center text-xs text-[var(--text-muted)] gap-1">
      <MapPin className="w-4 h-4" />
      <span>{lat.toFixed(4)}, {lng.toFixed(4)}</span>
      <span className="text-[10px]">Map unavailable</span>
    </div>
  );
}

export default function PortMarkerMap({ lat, lng, height = '150px' }: PortMarkerMapProps) {
  if (!isMapAvailable()) {
    return <MapPlaceholder lat={lat} lng={lng} height={height} />;
  }

  return (
    <MapProvider>
      <div style={{ height }} className="rounded-lg overflow-hidden">
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={12}
          gestureHandling="cooperative"
          disableDefaultUI
          mapId="port-marker-map"
        >
          <AdvancedMarker position={{ lat, lng }} />
        </Map>
      </div>
    </MapProvider>
  );
}
