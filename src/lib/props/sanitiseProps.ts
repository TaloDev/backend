import Prop from '../../entities/prop'

export default (props: Prop[], deleteNull: boolean = false): Prop[] => {
  if (!Array.isArray(props)) throw new Error('Props must be an array')

  if (deleteNull) props = props.filter((prop) => prop.value !== null)

  return props.map((prop) => new Prop(prop.key, prop.value))
}
