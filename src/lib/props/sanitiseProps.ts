import Prop from '../../entities/prop'

const sanitiseProps = (props: Prop[], deleteNull = false, extraFilter?: (prop: Prop) => boolean): Prop[] => {
  if (deleteNull) props = props.filter((prop) => prop.value !== null)

  return props
    .filter((prop) => Boolean(prop.key))
    .filter((prop) => extraFilter?.(prop) ?? true)
    .map((prop) => new Prop(String(prop.key), prop.value !== null ? String(prop.value) : null))
}

export default sanitiseProps
