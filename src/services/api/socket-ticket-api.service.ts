import { Request, Response, Route } from 'koa-clay'
import APIService from './api-service'
import { createRedisConnection } from '../../config/redis.config'
import { v4 } from 'uuid'
import Redis from 'ioredis'
import APIKey from '../../entities/api-key'
import SocketTicketAPIDocs from '../../docs/socket-tickets-api.docs'
import { TraceService } from '../../lib/routing/trace-service'

export async function createSocketTicket(redis: Redis, key: APIKey, devBuild: boolean): Promise<string> {
  const ticket = v4()
  const payload = `${key.id}:${devBuild ? '1' : '0'}`
  await redis.set(`socketTickets.${ticket}`, payload, 'EX', 300)

  return ticket
}

@TraceService()
export default class SocketTicketAPIService extends APIService {
  @Route({
    method: 'POST',
    docs: SocketTicketAPIDocs.post
  })
  async post(req: Request): Promise<Response> {
    const redis = createRedisConnection(req.ctx)

    const ticket = await createSocketTicket(redis, req.ctx.state.key, req.headers['x-talo-dev-build'] === '1')

    return {
      status: 200,
      body: {
        ticket
      }
    }
  }
}
