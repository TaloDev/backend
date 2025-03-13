import { uniqWith } from 'lodash'
import Prop from '../../entities/prop'

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
    .filter((prop) => Boolean(prop.key))
    .filter((prop) => extraFilter?.(prop) ?? true)
    .map((prop) => ({ key: String(prop.key), value: prop.value !== null ? String(prop.value) : null }))
    .filter((prop) => deleteNull ? prop.value !== null : true)
}

export function hardSanitiseProps(props: UnsanitisedProp[], extraFilter?: (prop: UnsanitisedProp) => boolean): Prop[] {
  return sanitiseProps(props, true, extraFilter).map((prop) => new Prop(prop.key, prop.value as string))
}
