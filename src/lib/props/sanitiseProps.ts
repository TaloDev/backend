import { uniqWith } from 'lodash-es'
import Prop, { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from '../../entities/prop.js'

export type PropRejectionReason =
  | 'PROP_KEY_TOO_LONG'
  | 'PROP_VALUE_TOO_LONG'
  | 'PROP_ARRAY_TOO_LONG'
  | 'PROP_CONTAINS_PROFANITY'
  | 'PROP_KEY_RESERVED'

export type RejectedProp = {
  key: string
  error: PropRejectionReason
  message: string
}

export type UnsanitisedProp = { key: string; value: string | null }

type SanitisedProps = { accepted: Prop[]; rejected: RejectedProp[] }

export const MAX_ARRAY_LENGTH = 1000

export const RESERVED_PROP_KEY_MESSAGE =
  "Prop keys starting with 'META_' are reserved for internal systems, please use another key name"

export const RESERVED_PROP_KEY_ERROR: PropRejectionReason = 'PROP_KEY_RESERVED'

export function isReservedPropKey(key: string): boolean {
  return key.startsWith('META_')
}

export function isArrayKey(key: string): boolean {
  return key.endsWith('[]')
}

// keeps the last value of a repeated scalar key, array keys are left alone
function dedupeScalarProps(props: UnsanitisedProp[]): UnsanitisedProp[] {
  const seenKeys = new Set<string>()
  const deduped: UnsanitisedProp[] = []

  for (let i = props.length - 1; i >= 0; i--) {
    const prop = props[i]

    if (!isArrayKey(prop.key)) {
      if (seenKeys.has(prop.key)) {
        continue
      }
      seenKeys.add(prop.key)
    }

    deduped.push(prop)
  }

  return deduped.reverse()
}

// runs after dedupe so a repeated reserved key is rejected once
export function applyReservedKeyRule({
  props,
  allowReservedKeys = false,
}: {
  props: UnsanitisedProp[]
  allowReservedKeys?: boolean
}): { props: UnsanitisedProp[]; rejected: RejectedProp[] } {
  const deduped = dedupeScalarProps(props)

  if (allowReservedKeys) {
    return { props: deduped, rejected: [] }
  }

  const rejected: RejectedProp[] = []
  const allowed = deduped.filter((prop) => {
    if (!isReservedPropKey(prop.key)) {
      return true
    }

    rejected.push({
      key: prop.key,
      error: RESERVED_PROP_KEY_ERROR,
      message: RESERVED_PROP_KEY_MESSAGE,
    })

    return false
  })

  return { props: allowed, rejected }
}

export function mergeAndSanitiseProps({
  prevProps,
  newProps,
  valueLimit,
}: {
  prevProps: Prop[]
  newProps: UnsanitisedProp[]
  valueLimit?: number
}): SanitisedProps {
  const { props: allowed, rejected: reservedRejected } = applyReservedKeyRule({
    props: newProps,
  })
  const sanitisedNew = sanitiseProps({ props: allowed, deleteNull: false })

  // scalar properties - simple strings
  const prevScalar = prevProps.filter((p) => !isArrayKey(p.key))
  const newScalar = sanitisedNew.filter((p) => !isArrayKey(p.key))
  const mergedScalar = uniqWith([...newScalar, ...prevScalar], (a, b) => a.key === b.key)

  // array properties - keys ending in []
  // multiple values per key allowed, new values replace old ones entirely
  const incomingArrayKeys = new Set(sanitisedNew.filter((p) => isArrayKey(p.key)).map((p) => p.key))
  const prevArray = prevProps.filter((p) => isArrayKey(p.key) && !incomingArrayKeys.has(p.key))
  const newArray = sanitisedNew.filter((p) => isArrayKey(p.key) && p.value !== null)
  const mergedArray = uniqWith(
    [...newArray, ...prevArray],
    (a, b) => a.key === b.key && a.value === b.value,
  )

  const rejected: RejectedProp[] = []

  const arrayKeyCounts = mergedArray.reduce<Record<string, number>>((acc, p) => {
    acc[p.key] = (acc[p.key] ?? 0) + 1
    return acc
  }, {})

  const overLimitKeys = new Set<string>()
  for (const [key, count] of Object.entries(arrayKeyCounts)) {
    if (count > MAX_ARRAY_LENGTH) {
      overLimitKeys.add(key)
      rejected.push({
        key,
        error: 'PROP_ARRAY_TOO_LONG',
        message: `Prop array length (${count}) for key '${key}' exceeds ${MAX_ARRAY_LENGTH} items`,
      })
    }
  }

  const filteredMergedArray = mergedArray.filter((p) => !overLimitKeys.has(p.key))

  const { accepted: hardAccepted, rejected: hardRejected } = hardSanitiseProps({
    props: [...mergedScalar, ...filteredMergedArray],
    valueLimit,
    allowReservedKeys: true,
  })

  return { accepted: hardAccepted, rejected: [...reservedRejected, ...rejected, ...hardRejected] }
}

// applies changes in order so later changes to the same key win
// a change that fails validation is skipped and its reasons collected
export function applyPropsInOrder<T extends UnsanitisedProp>({
  prevProps,
  changes,
  valueLimit,
}: {
  prevProps: Prop[]
  changes: T[]
  valueLimit?: number
}): {
  accepted: Prop[]
  applied: T[]
  rejected: { change: T; reasons: RejectedProp[] }[]
} {
  let accepted = prevProps
  const applied: T[] = []
  const rejected: { change: T; reasons: RejectedProp[] }[] = []

  for (const change of changes) {
    const result = mergeAndSanitiseProps({
      prevProps: accepted,
      newProps: [change],
      valueLimit,
    })

    if (result.rejected.length > 0) {
      rejected.push({ change, reasons: result.rejected })
      continue
    }

    accepted = result.accepted
    applied.push(change)
  }

  return { accepted, applied, rejected }
}

export function sanitiseProps({
  props,
  deleteNull = false,
  extraFilter,
}: {
  props: UnsanitisedProp[]
  deleteNull?: boolean
  extraFilter?: (prop: UnsanitisedProp) => boolean
}): UnsanitisedProp[] {
  props = dedupeScalarProps(props)

  if (deleteNull) {
    props = props.filter((prop) => prop.value !== null)
  }

  return props
    .filter((prop) => {
      const validKey = Boolean(prop.key)
      const extraFilterSuccess = extraFilter?.(prop) ?? true
      return validKey && extraFilterSuccess
    })
    .map((prop) => ({
      key: String(prop.key),
      value: prop.value === null ? null : String(prop.value),
    }))
}

export function testPropSize({
  key,
  value,
  valueLimit,
}: {
  key: string
  value: string | null
  valueLimit?: number
}): RejectedProp | null {
  if (key.length > MAX_KEY_LENGTH) {
    return {
      key,
      error: 'PROP_KEY_TOO_LONG',
      message: `Prop key length (${key.length}) exceeds ${MAX_KEY_LENGTH} characters`,
    }
  }

  const safeValueLimit = valueLimit || MAX_VALUE_LENGTH
  if (value && value.length > safeValueLimit) {
    return {
      key,
      error: 'PROP_VALUE_TOO_LONG',
      message: `Prop value length (${value.length}) exceeds ${safeValueLimit} characters`,
    }
  }

  return null
}

export function hardSanitiseProps({
  props,
  extraFilter,
  valueLimit,
  allowReservedKeys = false,
}: {
  props: UnsanitisedProp[]
  extraFilter?: (prop: UnsanitisedProp) => boolean
  valueLimit?: number
  // integrations write META_ keys themselves
  allowReservedKeys?: boolean
}): SanitisedProps {
  const { props: candidates, rejected: reservedRejected } = applyReservedKeyRule({
    props,
    allowReservedKeys,
  })

  const rejected: RejectedProp[] = []
  const accepted: Prop[] = []

  sanitiseProps({ props: candidates, deleteNull: true, extraFilter }).forEach((prop) => {
    const sizeRejection = testPropSize({ key: prop.key, value: prop.value, valueLimit })
    if (sizeRejection) {
      rejected.push(sizeRejection)
    } else {
      accepted.push(new Prop(prop.key, prop.value as string))
    }
  })

  return { accepted, rejected: [...reservedRejected, ...rejected] }
}
