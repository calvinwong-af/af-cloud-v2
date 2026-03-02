// ─── Shared types for CreateShipmentModal step components ────────────────────

export type OrderType = 'SEA_FCL' | 'SEA_LCL' | 'AIR';

export interface ContainerRow {
  container_size: string;
  container_type: string;
  quantity: number;
}

export interface PackageRow {
  packaging_type: string;
  quantity: number;
  gross_weight_kg: number | null;
  volume_cbm: number | null;
}

export interface Company {
  company_id: string;
  name: string;
}

export interface Port {
  un_code: string;
  name: string;
  country: string;
  port_type: string;
  has_terminals: boolean;
  terminals: Array<{ terminal_id: string; name: string; is_default: boolean }>;
}
