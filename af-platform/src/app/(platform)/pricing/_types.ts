export interface MonthBucket {
  month_key: string;
  label: string;
  isCurrentMonth: boolean;
}

export type PanelMode =
  | { type: 'view' };
