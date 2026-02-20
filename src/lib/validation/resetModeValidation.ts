export const resetModes = ['all', 'live', 'dev'] as const

export function translateResetMode(resetMode: (typeof resetModes)[number]) {
  switch (resetMode) {
    case 'all':
      return 'All players'
    case 'live':
      return 'Live players'
    case 'dev':
      return 'Dev players'
  }
}
