import type { RejectedProp } from './sanitiseProps.js'
import { hasProfanity } from '../filters/profanity.js'
import { isArrayKey, type UnsanitisedProp } from './sanitiseProps.js'

function isProfaneValue(value: string | null) {
  return value !== null && hasProfanity(value)
}

export function filterProfaneProps<T extends UnsanitisedProp>(
  props: T[],
  enabled: boolean,
): { accepted: T[]; rejected: RejectedProp[] } {
  if (!enabled) {
    return { accepted: props, rejected: [] }
  }

  const accepted: T[] = []
  const rejectedMap = new Map<string, RejectedProp>()

  const arrayGroups = new Map<string, T[]>()
  for (const prop of props) {
    if (isArrayKey(prop.key)) {
      const group = arrayGroups.get(prop.key) ?? []
      group.push(prop)
      arrayGroups.set(prop.key, group)
    }
  }

  for (const [key, group] of arrayGroups) {
    if (group.some((p) => isProfaneValue(p.value))) {
      rejectedMap.set(key, {
        key,
        error: 'PROP_CONTAINS_PROFANITY',
        message: 'Prop value contains profanity',
      })
    }
  }

  for (const prop of props) {
    if (rejectedMap.has(prop.key)) {
      continue
    }

    if (isArrayKey(prop.key)) {
      accepted.push(prop)
      continue
    }

    if (isProfaneValue(prop.value)) {
      rejectedMap.set(prop.key, {
        key: prop.key,
        error: 'PROP_CONTAINS_PROFANITY',
        message: 'Prop value contains profanity',
      })
    } else {
      accepted.push(prop)
    }
  }

  return { accepted, rejected: Array.from(rejectedMap.values()) }
}
