import { RouteDocs } from 'koa-clay'
import { APIKeyScope } from '../entities/api-key'

type APIRouteDocs = RouteDocs & {
  scopes?: APIKeyScope[]
}

type APIDocs<T> = {
  [key in keyof T]?: APIRouteDocs
}

export default APIDocs
