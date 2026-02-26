'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCompaniesForShipmentAction } from '@/app/actions/shipments';
import CreateShipmentModal from './CreateShipmentModal';

export default function NewShipmentButton() {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<{ company_id: string; name: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchCompaniesForShipmentAction().then(setCompanies);
  }, []);

  function handleCreated(shipmentOrderId: string) {
    setOpen(false);
    router.push(`/shipments/${shipmentOrderId}`);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--slate)] text-white rounded-lg text-sm font-medium hover:bg-[var(--slate-mid)] transition-colors"
      >
        <span className="text-base leading-none">+</span>
        New Shipment
      </button>
      {open && (
        <CreateShipmentModal
          companies={companies}
          onClose={() => setOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
