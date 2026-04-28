// Format a US phone number into the canonical (xxx) xxx-xxxx mask.
// Drops a leading "1" so a pasted "+1 (205) 555-1234" is preserved correctly
// (previously, slice(0,10) on "12055551234" silently produced "(120) 555-5123"
// — wrong area code, no warning).
export function formatPhoneNumber(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1)
  }
  digits = digits.slice(0, 10)
  if (digits.length <= 3) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
