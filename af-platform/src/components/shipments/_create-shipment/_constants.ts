// ─── Shared constants for CreateShipmentModal step components ────────────────

export const CONTAINER_SIZES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF'];
export const CONTAINER_TYPES = ['DRY', 'REEFER', 'OPEN_TOP', 'FLAT_RACK'];
export const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CNF', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

export const ORDER_TYPES = [
  { value: 'SEA_FCL', label: 'Sea Freight — FCL', sublabel: 'Full Container Load' },
  { value: 'SEA_LCL', label: 'Sea Freight — LCL', sublabel: 'Less than Container Load' },
  { value: 'AIR',     label: 'Air Freight',        sublabel: 'Airport to Airport' },
] as const;

export const PACKAGING_TYPES = [
  { value: 'CARTON', label: 'Carton' },
  { value: 'PALLET', label: 'Pallet' },
  { value: 'CRATE',  label: 'Crate' },
  { value: 'DRUM',   label: 'Drum' },
  { value: 'BAG',    label: 'Bag' },
  { value: 'BUNDLE', label: 'Bundle' },
  { value: 'OTHER',  label: 'Other' },
];

export const BASE_STEPS = [
  { id: 1, label: 'Order' },
  { id: 2, label: 'Route' },
  { id: 3, label: 'Cargo' },
  { id: 4, label: 'Containers' },
  { id: 5, label: 'Review' },
];
