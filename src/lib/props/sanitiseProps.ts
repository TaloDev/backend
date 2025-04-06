import { uniqWith } from 'lodash'
import Prop, { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from '../../entities/prop'
import { PropSizeError } from '../errors/propSizeError'

type UnsanitisedProp = { key: string, value: string | null }

export function mergeAndSanitiseProps(prevProps: Prop[], newProps: UnsanitisedProp[], extraFilter?: (prop: UnsanitisedProp) => boolean): Prop[] {
  const mergedProps = uniqWith([
    ...sanitiseProps(newProps, false, extraFilter),
    ...prevProps
  ], (a, b) => a.key === b.key)

  return hardSanitiseProps(mergedProps, extraFilter)
}

export function sanitiseProps(props: UnsanitisedProp[], deleteNull = false, extraFilter?: (prop: UnsanitisedProp) => boolean): UnsanitisedProp[] {
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

export function hardSanitiseProps(props: UnsanitisedProp[], extraFilter?: (prop: UnsanitisedProp) => boolean): Prop[] {
  return sanitiseProps(props, true, extraFilter).map((prop) => {
    if (prop.key.length > MAX_KEY_LENGTH) {
      throw new PropSizeError(`Prop key length (${prop.key.length}) exceeds ${MAX_KEY_LENGTH} characters`)
    }
    if (prop.value && prop.value.length > MAX_VALUE_LENGTH) {
      throw new PropSizeError(`Prop value length (${prop.value.length}) exceeds ${MAX_VALUE_LENGTH} characters`)
    }

    return new Prop(prop.key, prop.value as string)
  })
}
