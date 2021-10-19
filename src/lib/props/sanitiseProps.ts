import Prop from '../../entities/prop'

const sanitiseProps = (props: Prop[], deleteNull = false): Prop[] => {
  if (!Array.isArray(props)) throw new Error('Props must be an array')

  if (deleteNull) props = props.filter((prop) => prop.value !== null)

  return props.map((prop) => new Prop(String(prop.key), prop.value ? String(prop.value) : null))
}

export default sanitiseProps
