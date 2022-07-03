import { Response, Service } from 'koa-clay'

export default class DocumentationService extends Service {
  async index(): Promise<Response> {
    return {
      status: 200,
      body: {
        docs: globalThis.clay.docs
      }
    }
  }
}
