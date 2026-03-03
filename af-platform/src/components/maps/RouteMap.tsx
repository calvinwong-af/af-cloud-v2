'use client';

import { Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import MapProvider, { isMapAvailable } from './MapProvider';
import { MapPin } from 'lucide-react';
import { useEffect } from 'react';

interface RouteMapProps {
  origin: { lat: number; lng: number; label?: string };
  destination: { lat: number; lng: number; label?: string };
  lastMile?: { lat: number; lng: number; label?: string } | null;
  height?: string;
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  }, [map, points]);

  return null;
}

function MapUnavailable({ height }: { height: string }) {
  return (
    <div style={{ height }} className="rounded-lg bg-[var(--surface)] flex flex-col items-center justify-center text-xs text-[var(--text-muted)] gap-1">
      <MapPin className="w-4 h-4" />
      <span>Map unavailable — coordinates not set</span>
    </div>
  );
}

export default function RouteMap({ origin, destination, lastMile, height = '300px' }: RouteMapProps) {
  if (!isMapAvailable()) {
    return <MapUnavailable height={height} />;
  }

  const points = [origin, destination];
  if (lastMile) points.push(lastMile);

  const center = {
    lat: (origin.lat + destination.lat) / 2,
    lng: (origin.lng + destination.lng) / 2,
  };

  return (
    <MapProvider>
      <div style={{ height }} className="rounded-lg overflow-hidden">
        <Map
          defaultCenter={center}
          defaultZoom={4}
          gestureHandling="none"
          disableDefaultUI
          mapId="route-map"
        >
          <FitBounds points={points} />
          {/* Origin — blue */}
          <AdvancedMarker position={origin}>
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />
          </AdvancedMarker>
          {/* Destination — red */}
          <AdvancedMarker position={destination}>
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow" />
          </AdvancedMarker>
          {/* Last mile — green */}
          {lastMile && (
            <AdvancedMarker position={lastMile}>
              <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow" />
            </AdvancedMarker>
          )}
        </Map>
      </div>
    </MapProvider>
  );
}
