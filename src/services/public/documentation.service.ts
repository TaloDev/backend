import { Response, Route, Service } from 'koa-clay'
import * as APIDocs from '../../docs'

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
    const enrichedDocs = this.enrichDocsWithScopes(clayDocs as unknown as Record<string, unknown>)

    return {
      status: 200,
      body: {
        docs: enrichedDocs
      }
    }
  }

  private enrichDocsWithScopes(clayDocs: Record<string, unknown>): Record<string, unknown> {
    const docs = JSON.parse(JSON.stringify(clayDocs))
    const services = (docs as { services?: Record<string, unknown>[] }).services
    if (!Array.isArray(services)) return docs

    for (const service of services) {
      const apiDocs = docsMap[service.name as keyof typeof docsMap]
      if (!apiDocs || !Array.isArray(service.routes)) continue

      for (const route of service.routes as Record<string, unknown>[]) {
        const match = Object.values(apiDocs).find(
          (doc) => doc?.description === route.description && doc.scopes
        )
        if (match) route.scopes = match.scopes
      }
    }

    return docs
  }
}
