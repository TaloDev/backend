// see RFC 4180 for CSV format: https://tools.ietf.org/html/rfc4180
export function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // escape quotes by doubling them and wrap entire value in quotes
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
