import { ClayDocs, Response, Route, RouteDocs, Service } from 'koa-clay'
import * as APIDocs from '../../docs'
import { APIKeyScope } from '../../entities/api-key'

type RouteDocsWithScopes = RouteDocs & { scopes?: APIKeyScope[] }

// ServiceName -> APIDocs
const docsMap = Object.fromEntries(
  Object.entries(APIDocs).map(([key, value]) => [
    key.replace('APIDocs', 'APIService'),
    value
  ])
)

export default class DocumentationService extends Service {
  @Route({
    method: 'GET'
  })
  async index(): Promise<Response> {
    const clayDocs = clay.docs
    const enrichedDocs = this.enrichDocsWithScopes(clayDocs)

    const services = [
      ...enrichedDocs.services,
      ...globalThis.talo.docs.toJSON().services
    ]

    return {
      status: 200,
      body: {
        docs: {
          services
        }
      }
    }
  }

  private enrichDocsWithScopes(clayDocs: ClayDocs) {
    const docs = JSON.parse(JSON.stringify(clayDocs)) as ClayDocs
    const services = docs.services

    for (const service of services) {
      const apiDocs = docsMap[service.name as keyof typeof docsMap]
      for (const route of service.routes) {
        const match = Object.values(apiDocs).find(
          (doc) => doc?.description === route.description && doc.scopes
        )
        if (match) {
          (route as RouteDocsWithScopes).scopes = match.scopes
        }
      }
    }

    return docs
  }
}
