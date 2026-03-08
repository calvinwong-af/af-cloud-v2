import type { RateDetail } from '@/app/actions/pricing';

export interface MonthBucket {
  month_key: string;
  label: string;
  isCurrentMonth: boolean;
}

export type PanelMode =
  | { type: 'view' }
  | { type: 'terminate'; rateId: number; current: RateDetail };
