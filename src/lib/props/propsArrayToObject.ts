import Props from '../types/props'

type PropsResource = {
  key: string,
  value: any
}

export default (propsArray: PropsResource[], deleteNull: boolean = false): Props => {
  if (!Array.isArray(propsArray)) {
    throw new Error('Props must be an array')
  }

  return propsArray.reduce((acc, curr) => {
    if (deleteNull && curr.value === null) return acc

    return {
      ...acc,
      // keep null keys for deletion later, convert others to strings
      [curr.key]: curr.value !== null ? String(curr.value) : null
    }
  }, {})
}
