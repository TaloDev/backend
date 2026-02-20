import Redis from 'ioredis'
import { v4 } from 'uuid'
import APIKey from '../../entities/api-key'

export async function createSocketTicket(redis: Redis, key: APIKey, devBuild: boolean) {
  const ticket = v4()
  const payload = `${key.id}:${devBuild ? '1' : '0'}`
  await redis.set(`socketTickets.${ticket}`, payload, 'EX', 300)

  return ticket
}
