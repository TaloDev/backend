export const resetModes = ['all', 'live', 'dev'] as const

export type ResetMode = (typeof resetModes)[number]

export function translateResetMode(resetMode: ResetMode) {
  switch (resetMode) {
    case 'all':
      return 'All players'
    case 'live':
      return 'Live players'
    case 'dev':
      return 'Dev players'
  }
}
