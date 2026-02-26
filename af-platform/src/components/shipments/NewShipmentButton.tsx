'use client';

import { useState } from 'react';
import CreateShipmentModal from './CreateShipmentModal';

interface Props {
  companies: { company_id: string; name: string }[];
  ports: { un_code: string; name: string; country: string; port_type: string }[];
}

export default function NewShipmentButton({ companies, ports }: Props) {
  const [open, setOpen] = useState(false);

  function handleCreated(shipmentOrderId: string) {
    setOpen(false);
    window.location.href = `/shipments/${shipmentOrderId}`;
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
          ports={ports}
          onClose={() => setOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
