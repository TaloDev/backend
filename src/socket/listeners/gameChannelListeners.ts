import { EntityManager, RequestContext } from '@mikro-orm/mysql'
import { Redis } from 'ioredis'
import { z, ZodType } from 'zod'
import { APIKeyScope } from '../../entities/api-key'
import GameChannel from '../../entities/game-channel'
import { incrementChannelTotalMessages } from '../../lib/queues/game-metrics/flush-channel-total-messages-queue-handler'
import { sendMessages } from '../messages/socketMessage'
import { SocketMessageListener } from '../router/createListener'
import createListener from '../router/createListener'

const ttl = 1

async function checkChannelExists({
  em,
  redis,
  channelId,
  gameId,
}: {
  em: EntityManager
  redis: Redis
  channelId: number
  gameId: number
}) {
  const existsKey = GameChannel.getSocketExistenceKey(channelId)
  const cache = await redis.get(existsKey)

  if (cache) {
    return cache === '1'
  }

  const results = await em
    .getConnection()
    .execute('select 1 from game_channel where id = ? and game_id = ? limit 1', [channelId, gameId])

  const exists = results.length > 0
  await redis.set(existsKey, exists ? '1' : '0', 'EX', ttl)

  return exists
}

async function getChannelMembers({
  em,
  redis,
  channelId,
}: {
  em: EntityManager
  redis: Redis
  channelId: number
}) {
  let memberIds: Set<string>

  const membersKey = GameChannel.getSocketMembersKey(channelId)
  const cache = await redis.get(membersKey)

  if (cache !== null) {
    memberIds = new Set(cache === '' ? [] : cache.split(','))
  } else {
    const results = await em
      .getConnection()
      .execute<{ player_alias_id: number }[]>(
        'select player_alias_id from game_channel_members where game_channel_id = ?',
        [channelId],
      )

    const ids = results.map(({ player_alias_id }) => String(player_alias_id))
    memberIds = new Set(ids)
    await redis.set(membersKey, ids.join(','), 'EX', ttl)
  }

  return memberIds
}

async function getChannelData({
  em,
  redis,
  channelId,
}: {
  em: EntityManager
  redis: Redis
  channelId: number
}) {
  const channelDataKey = GameChannel.getSocketDataKey(channelId)
  const cache = await redis.get(channelDataKey)

  if (cache) {
    return JSON.parse(cache)
  }

  const channel = await em.repo(GameChannel).findOneOrFail(channelId)
  const data = channel.toJSON()

  await redis.set(channelDataKey, JSON.stringify(data), 'EX', ttl)

  return data
}

const gameChannelListeners = [
  createListener(
    'v1.channels.message',
    z.object({
      channel: z.object({
        id: z.number(),
      }),
      message: z.string(),
    }),
    async ({ conn, data, socket }) => {
      const redis = socket.redis

      const channelId = data.channel.id
      const gameId = conn.gameId
      const aliasId = conn.playerAliasId

      const em = RequestContext.getEntityManager() as EntityManager
      const channelExists = await checkChannelExists({ em, redis, channelId, gameId })
      const channelMembers = await getChannelMembers({ em, redis, channelId })

      if (!channelExists) {
        throw new Error('Channel not found')
      }

      if (!channelMembers.has(String(aliasId))) {
        throw new Error('Player not in channel')
      }

      const conns = socket.findConnections((conn) => {
        return (
          conn.hasScope(APIKeyScope.READ_GAME_CHANNELS) &&
          channelMembers.has(String(conn.playerAliasId))
        )
      })

      sendMessages(conns, 'v1.channels.message', {
        channel: await getChannelData({ em, redis, channelId }),
        message: data.message,
        playerAlias: await conn.getPlayerAlias(),
      })

      await incrementChannelTotalMessages(channelId)
    },
    {
      apiKeyScopes: [APIKeyScope.WRITE_GAME_CHANNELS],
    },
  ),
] as unknown as SocketMessageListener<ZodType>[]

export default gameChannelListeners
