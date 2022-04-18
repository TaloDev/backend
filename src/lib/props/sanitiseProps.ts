import Prop from '../../entities/prop'

const sanitiseProps = (props: Prop[], deleteNull = false): Prop[] => {
  if (deleteNull) props = props.filter((prop) => prop.value !== null)

  return props.filter((prop) => Boolean(prop.key)).map((prop) => new Prop(String(prop.key), prop.value ? String(prop.value) : null))
}

export default sanitiseProps
