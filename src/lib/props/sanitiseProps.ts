import { uniqWith } from 'lodash'
import Prop, { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from '../../entities/prop'
import { PropSizeError } from '../errors/propSizeError'

type UnsanitisedProp = { key: string, value: string | null }

export function mergeAndSanitiseProps({
  prevProps,
  newProps,
  extraFilter,
  valueLimit
}: {
  prevProps: Prop[]
  newProps: UnsanitisedProp[]
  extraFilter?: (prop: UnsanitisedProp) => boolean
  valueLimit?: number
}): Prop[] {
  const mergedProps = uniqWith([
    ...sanitiseProps({ props: newProps, deleteNull: false, extraFilter }),
    ...prevProps
  ], (a, b) => a.key === b.key)

  return hardSanitiseProps({ props: mergedProps, valueLimit })
}

export function sanitiseProps({
  props,
  deleteNull = false,
  extraFilter
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
      value: prop.value === null ? null : String(prop.value)
    }))
}

export function testPropSize({
  key,
  value,
  valueLimit
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
    throw new PropSizeError(`Prop value length (${value.length}) exceeds ${safeValueLimit} characters`)
  }
}

export function hardSanitiseProps({
  props,
  extraFilter,
  valueLimit
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
