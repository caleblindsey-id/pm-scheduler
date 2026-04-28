export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const INTERVAL_OPTIONS = [
  { value: 1,  label: 'Every month' },
  { value: 2,  label: 'Every 2 months' },
  { value: 3,  label: 'Every 3 months' },
  { value: 4,  label: 'Every 4 months' },
  { value: 6,  label: 'Every 6 months' },
  { value: 12, label: 'Once a year' },
]

export function describeSchedule(intervalMonths: number, anchorMonth: number): string {
  const intervalLabel = INTERVAL_OPTIONS.find((o) => o.value === intervalMonths)?.label
    ?? `Every ${intervalMonths} months`
  return `${intervalLabel}, starting ${MONTHS[anchorMonth - 1]}`
}

export function formatMonthYear(month: number | null, year: number | null): string {
  if (!month || !year || month < 1 || month > 12) return '—'
  return `${MONTHS[month - 1]} ${year}`
}

// Project the next PM month for a given schedule, starting from (fromMonth, fromYear).
// Skips months already covered by an existing non-skipped ticket (keys formatted "YYYY-M").
// Returns null if no eligible month is found within 24 months, or if inputs are invalid.
export function calcNextServiceMonth(
  intervalMonths: number,
  anchorMonth: number,
  fromMonth: number,
  fromYear: number,
  existingKeys: Set<string>
): { month: number; year: number } | null {
  if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) return null
  if (!Number.isFinite(anchorMonth) || anchorMonth < 1 || anchorMonth > 12) return null
  if (!Number.isFinite(fromMonth) || fromMonth < 1 || fromMonth > 12) return null

  for (let offset = 0; offset < 24; offset++) {
    const candidateMonth = ((fromMonth - 1 + offset) % 12) + 1
    const candidateYear = fromYear + Math.floor((fromMonth - 1 + offset) / 12)

    const diff = ((candidateMonth - anchorMonth) % intervalMonths + intervalMonths) % intervalMonths
    if (diff === 0) {
      const key = `${candidateYear}-${candidateMonth}`
      if (!existingKeys.has(key)) {
        return { month: candidateMonth, year: candidateYear }
      }
    }
  }

  return null
}
