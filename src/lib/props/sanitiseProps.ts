import { uniqWith } from 'lodash-es'
import Prop, { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from '../../entities/prop.js'

type PropRejectionReason =
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

export const MAX_ARRAY_LENGTH = 1000

export type UnsanitisedProp = { key: string; value: string | null }

export function isArrayKey(key: string): boolean {
  return key.endsWith('[]')
}

export function mergeAndSanitiseProps({
  prevProps,
  newProps,
  extraFilter,
  valueLimit,
}: {
  prevProps: Prop[]
  newProps: UnsanitisedProp[]
  extraFilter?: (prop: UnsanitisedProp) => boolean
  valueLimit?: number
}): { accepted: Prop[]; rejected: RejectedProp[] } {
  const sanitisedNew = sanitiseProps({ props: newProps, deleteNull: false, extraFilter })

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
  })

  return { accepted: hardAccepted, rejected: [...rejected, ...hardRejected] }
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
  if (deleteNull) props = props.filter((prop) => prop.value !== null)

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
}: {
  props: UnsanitisedProp[]
  extraFilter?: (prop: UnsanitisedProp) => boolean
  valueLimit?: number
}): { accepted: Prop[]; rejected: RejectedProp[] } {
  const rejected: RejectedProp[] = []
  const accepted: Prop[] = []

  sanitiseProps({ props, deleteNull: true, extraFilter }).forEach((prop) => {
    const sizeRejection = testPropSize({ key: prop.key, value: prop.value, valueLimit })
    if (sizeRejection) {
      rejected.push(sizeRejection)
    } else {
      accepted.push(new Prop(prop.key, prop.value as string))
    }
  })

  return { accepted, rejected }
}
