import { camelCase } from 'lodash'

export default function handleSQLError(err: Error) {
  if ('sqlState' in err && err.sqlState === '22003') {
    const regex = /Out of range value for column '(\w+)' at row 1/
    const match = err.message.match(regex)
    return {
      status: 400,
      body: {
        errors: {
          [camelCase(match[1])]: ['Value is out of range']
        }
      }
    }
  /* v8 ignore start */
  } else {
    throw err
  }
  /* v8 ignore stop */
}
