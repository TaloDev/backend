export function calculateChange(newCount: number, prevCount: number): number {
  if (prevCount === 0) {
    return newCount
  }

  return (newCount - prevCount) / prevCount
}
