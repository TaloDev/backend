import { Redis } from 'ioredis'
import APIKey from '../entities/api-key'
import { RequestContext } from '@mikro-orm/mysql'

export default class SocketTicket {
  apiKey!: APIKey
  devBuild!: boolean

  constructor(private readonly ticket: string) { }

  async validate(redis: Redis): Promise<boolean> {
    const ticketValue = await redis.get(`socketTickets.${this.ticket}`)
    if (ticketValue) {
      await redis.del(`socketTickets.${this.ticket}`)
      const [keyId, devBuild] = ticketValue.split(':')

      try {
        this.devBuild = devBuild === '1'

        const em = RequestContext.getEntityManager()!
        this.apiKey = await em.getRepository(APIKey).findOneOrFail({
          id: Number(keyId),
          revokedAt: null
        }, {
          populate: ['game']
        })

        return true
      } catch (error) {
        return false
      }
    }
    return false
  }
}
