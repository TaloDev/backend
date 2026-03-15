import { uniqWith } from 'lodash'
import Prop, { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from '../../entities/prop'
import { PropSizeError } from '../errors/propSizeError'

export const MAX_ARRAY_LENGTH = 1000

type UnsanitisedProp = { key: string; value: string | null }

function isArrayKey(key: string): boolean {
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
}): Prop[] {
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

  const arrayKeyCounts = mergedArray.reduce<Record<string, number>>((acc, p) => {
    acc[p.key] = (acc[p.key] ?? 0) + 1
    return acc
  }, {})

  for (const [key, count] of Object.entries(arrayKeyCounts)) {
    if (count > MAX_ARRAY_LENGTH) {
      throw new PropSizeError(
        `Prop array length (${count}) for key '${key}' exceeds ${MAX_ARRAY_LENGTH} items`,
      )
    }
  }

  return hardSanitiseProps({ props: [...mergedScalar, ...mergedArray], valueLimit })
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
}): void {
  if (key.length > MAX_KEY_LENGTH) {
    throw new PropSizeError(`Prop key length (${key.length}) exceeds ${MAX_KEY_LENGTH} characters`)
  }

  const safeValueLimit = valueLimit || MAX_VALUE_LENGTH
  if (value && value.length > safeValueLimit) {
    throw new PropSizeError(
      `Prop value length (${value.length}) exceeds ${safeValueLimit} characters`,
    )
  }
}

export function hardSanitiseProps({
  props,
  extraFilter,
  valueLimit,
}: {
  props: UnsanitisedProp[]
  extraFilter?: (prop: UnsanitisedProp) => boolean
  valueLimit?: number
}): Prop[] {
  return sanitiseProps({ props, deleteNull: true, extraFilter }).map((prop) => {
    testPropSize({ key: prop.key, value: prop.value, valueLimit })
    return new Prop(prop.key, prop.value as string)
  })
}
