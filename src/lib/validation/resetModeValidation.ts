import { ValidationCondition } from 'koa-clay'

export type ResetMode = 'all' | 'live' | 'dev'

const allowedModes: ResetMode[] = ['all', 'live', 'dev']

export const resetModeValidation = {
  validation: async (val: unknown): Promise<ValidationCondition[]> => {
    const mode = val as ResetMode
    return [
      {
        check: !!val && allowedModes.includes(mode),
        error: `Mode must be one of: ${allowedModes.join(', ')}`
      }
    ]
  }
}

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
