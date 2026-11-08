import axios from 'axios'
import AxiosMockAdapter from 'axios-mock-adapter'

export default function createAxiosMock() {
  // the adapter's types are CJS, axios is ESM - same object at runtime
  // @ts-expect-error
  return new AxiosMockAdapter(axios)
}
