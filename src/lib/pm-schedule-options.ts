import type { BillingType } from '@/types/database'

export const MONTHS = [
  { value: 1,  label: 'January' },
  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

export const INTERVAL_OPTIONS = [
  { value: 1,  label: 'Monthly' },
  { value: 2,  label: 'Bi-Monthly' },
  { value: 3,  label: 'Quarterly' },
  { value: 6,  label: 'Semi-Annual' },
  { value: 12, label: 'Annual' },
] as const

export const BILLING_TYPES: ReadonlyArray<{ value: BillingType; label: string }> = [
  { value: 'flat_rate',           label: 'Flat Rate' },
  { value: 'time_and_materials',  label: 'Time & Materials' },
  { value: 'contract',            label: 'Contract' },
]
