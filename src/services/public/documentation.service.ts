import { Response, Route, Service } from 'koa-clay'

export default class DocumentationService extends Service {
  @Route({
    method: 'GET'
  })
  async index(): Promise<Response> {
    return {
      status: 200,
      body: {
        docs: global.clay.docs
      }
    }
  }
}
