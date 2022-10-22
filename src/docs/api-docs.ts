import { RouteDocs } from 'koa-clay'

type APIDocs<T> = {
  [key in keyof T]?: RouteDocs
}

export default APIDocs
