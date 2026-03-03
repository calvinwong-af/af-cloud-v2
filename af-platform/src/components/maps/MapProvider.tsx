'use client';

import { APIProvider } from '@vis.gl/react-google-maps';

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export function isMapAvailable(): boolean {
  return !!MAPS_KEY && MAPS_KEY !== 'PENDING';
}

export default function MapProvider({ children }: { children: React.ReactNode }) {
  if (!isMapAvailable()) {
    return <>{children}</>;
  }

  return (
    <APIProvider apiKey={MAPS_KEY}>
      {children}
    </APIProvider>
  );
}
