import { forwardRequest, ForwardTo, HasPermission, Request, Response, Route, Validate } from 'koa-clay'
import GameChannelAPIPolicy from '../../policies/api/game-channel-api.policy'
import APIService from './api-service'
import GameChannel, { GameChannelLeavingReason } from '../../entities/game-channel'
import { EntityManager, FilterQuery, LockMode } from '@mikro-orm/mysql'
import GameChannelAPIDocs from '../../docs/game-channel-api.docs'
import PlayerAlias from '../../entities/player-alias'
import GameChannelStorageProp from '../../entities/game-channel-storage-prop'
import { PropSizeError } from '../../lib/errors/propSizeError'
import { sanitiseProps, testPropSize } from '../../lib/props/sanitiseProps'
import { TraceService } from '../../lib/tracing/trace-service'
import Redis from 'ioredis'
import { pageValidation } from '../../lib/pagination/pageValidation'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination/itemsPerPage'
import Player from '../../entities/player'

type GameChannelStorageTransaction = {
  upsertedProps: GameChannelStorageProp[]
  deletedProps: GameChannelStorageProp[]
  failedProps: { key: string, error: string }[]
}

type PutStorageRequest = {
  props: {
    key: string
    value: string | null
  }[]
}
type PutStorageResponse = GameChannelStorageTransaction & { channel: GameChannel }

function canModifyChannel(channel: GameChannel, alias: PlayerAlias): boolean {
  return channel.owner ? channel.owner.id === alias.id : false
}

async function joinChannel(req: Request, channel: GameChannel, playerAlias: PlayerAlias) {
  if (!channel.hasMember(playerAlias.id)) {
    channel.members.add(playerAlias)
    await channel.sendMessageToMembers(req.ctx.wss, 'v1.channels.player-joined', {
      channel,
      playerAlias
    })

    await (req.ctx.em as EntityManager).flush()
  }
}

@TraceService()
export default class GameChannelAPIService extends APIService {
  @Route({
    method: 'GET',
    docs: GameChannelAPIDocs.index
  })
  @HasPermission(GameChannelAPIPolicy, 'index')
  @ForwardTo('games.game-channels', 'index')
  async index(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Route({
    method: 'GET',
    path: '/subscriptions',
    docs: GameChannelAPIDocs.subscriptions
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'subscriptions')
  async subscriptions(req: Request): Promise<Response> {
    const { propKey, propValue } = req.query
    const em: EntityManager = req.ctx.em

    const where: FilterQuery<GameChannel> = {
      members: {
        $some: {
          id: req.ctx.state.alias.id
        }
      }
    }

    if (propKey) {
      if (propValue) {
        where.props = {
          $some: {
            key: propKey,
            value: propValue
          }
        }
      } else {
        where.props = {
          $some: {
            key: propKey
          }
        }
      }
    }

    const channels = await em.repo(GameChannel).find(where)

    return {
      status: 200,
      body: {
        channels: await Promise.all(channels.map((channel) => channel.toJSONWithCount(req.ctx.em, req.ctx.state.includeDevData)))
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:id',
    docs: GameChannelAPIDocs.get
  })
  @HasPermission(GameChannelAPIPolicy, 'get')
  async get(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'POST',
    docs: GameChannelAPIDocs.post
  })
  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'post')
  @ForwardTo('games.game-channels', 'post')
  async post(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Route({
    method: 'POST',
    path: '/:id/join',
    docs: GameChannelAPIDocs.join
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'join')
  async join(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (channel.private) {
      req.ctx.throw(403, 'This channel is private')
    }
    await joinChannel(req, channel, req.ctx.state.alias)

    return {
      status: 200,
      body: {
        channel: await channel.toJSONWithCount(em, req.ctx.state.includeDevData)
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/:id/leave',
    docs: GameChannelAPIDocs.leave
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'leave')
  async leave(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel
    const playerAlias: PlayerAlias = req.ctx.state.alias

    if (channel.hasMember(req.ctx.state.alias.id)) {
      await channel.sendMessageToMembers(req.ctx.wss, 'v1.channels.player-left', {
        channel,
        playerAlias,
        meta: {
          reason: GameChannelLeavingReason.DEFAULT
        }
      })

      if (channel.shouldAutoCleanup(playerAlias)) {
        await channel.sendDeletedMessage(req.ctx.wss)
        await em.removeAndFlush(channel)

        return {
          status: 204
        }
      }

      if (channel.owner?.id === req.ctx.state.alias.id) {
        channel.owner = null
      }
      channel.members.remove(playerAlias)

      await em.flush()
    }

    return {
      status: 204
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id',
    docs: GameChannelAPIDocs.put
  })
  @Validate({
    headers: ['x-talo-alias'],
    body: [GameChannel]
  })
  @HasPermission(GameChannelAPIPolicy, 'put')
  @ForwardTo('games.game-channels', 'put')
  async put(req: Request): Promise<Response> {
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    return forwardRequest(req)
  }

  @Route({
    method: 'DELETE',
    path: '/:id',
    docs: GameChannelAPIDocs.delete
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'delete')
  @ForwardTo('games.game-channels', 'delete')
  async delete(req: Request): Promise<Response> {
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    return forwardRequest(req)
  }

  @Route({
    method: 'POST',
    path: '/:id/invite',
    docs: GameChannelAPIDocs.invite
  })
  @Validate({
    headers: ['x-talo-alias']
  })
  @HasPermission(GameChannelAPIPolicy, 'invite')
  async invite(req: Request<{ inviteeAliasId: number }>): Promise<Response> {
    const { inviteeAliasId } = req.body
    const em: EntityManager = req.ctx.em
    const channel: GameChannel = req.ctx.state.channel

    if (!canModifyChannel(channel, req.ctx.state.alias)) {
      req.ctx.throw(403, 'This player is not the owner of the channel')
    }

    const inviteeAlias = await em.getRepository(PlayerAlias).findOne({
      id: inviteeAliasId,
      player: {
        game: req.ctx.state.game
      }
    })
    if (!inviteeAlias) {
      req.ctx.throw(404, 'Invitee not found')
    }
    if (inviteeAlias.id === req.ctx.state.alias.id) {
      req.ctx.throw(400, 'Players cannot invite themselves')
    }

    await joinChannel(req, channel, inviteeAlias)

    return {
      status: 204
    }
  }

  @Route({
    method: 'GET',
    path: '/:id/members',
    docs: GameChannelAPIDocs.members
  })
  @Validate({
    headers: ['x-talo-alias'],
    query: {
      page: pageValidation
    }
  })
  @HasPermission(GameChannelAPIPolicy, 'members')
  async members(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE
    const {
      page = 0,
      playerId,
      aliasId,
      identifier,
      playerPropKey,
      playerPropValue,
      playerGroupId
    } = req.query
    const em: EntityManager = req.ctx.em

    const channel: GameChannel = req.ctx.state.channel
    const alias: PlayerAlias = req.ctx.state.alias

    if (!channel.hasMember(alias.id)) {
      req.ctx.throw(403, 'This player is not a member of the channel')
    }

    const playerFilter: FilterQuery<Player> = req.ctx.state.includeDevData ? {} : { devBuild: false }

    if (playerId) {
      playerFilter.id = playerId
    }
    if (playerPropKey) {
      if (playerPropValue) {
        playerFilter.props = {
          $some: {
            key: playerPropKey,
            value: playerPropValue
          }
        }
      } else {
        playerFilter.props = {
          $some: {
            key: playerPropKey
          }
        }
      }
    }

    if (playerGroupId) {
      playerFilter.groups = {
        $some: playerGroupId
      }
    }

    const where: FilterQuery<PlayerAlias> = {
      channels: {
        $some: channel
      },
      player: playerFilter
    }

    if (aliasId) {
      where.id = Number(aliasId)
    }
    if (identifier) {
      where.identifier = identifier
    }

    const [members, count] = await em.repo(PlayerAlias).findAndCount(where, {
      limit: itemsPerPage + 1,
      offset: Number(page) * itemsPerPage
    })

    return {
      status: 200,
      body: {
        members: members.slice(0, itemsPerPage),
        count,
        itemsPerPage,
        isLastPage: members.length <= itemsPerPage
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/:id/storage'
  })
  @Validate({
    headers: ['x-talo-alias'],
    query: ['propKey']
  })
  @HasPermission(GameChannelAPIPolicy, 'getStorage')
  async getStorage(req: Request): Promise<Response> {
    const { propKey } = req.query
    const em: EntityManager = req.ctx.em

    const channel: GameChannel = req.ctx.state.channel

    if (!channel.hasMember(req.ctx.state.alias.id)) {
      req.ctx.throw(403, 'This player is not a member of the channel')
    }

    let result: GameChannelStorageProp | null = null

    const redis: Redis = req.ctx.redis
    const cachedProp = await redis.get(GameChannelStorageProp.getRedisKey(channel.id, propKey))

    if (cachedProp) {
      return {
        status: 200,
        body: {
          prop: JSON.parse(cachedProp)
        }
      }
    }

    result = await em.repo(GameChannelStorageProp).findOne({
      gameChannel: channel,
      key: propKey
    })

    if (result) {
      await result.persistToRedis(redis)
    }

    return {
      status: 200,
      body: {
        prop: result
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id/storage'
  })
  @Validate({
    headers: ['x-talo-alias'],
    body: {
      props: {
        required: true,
        validation: async (val) => [
          {
            check: Array.isArray(val),
            error: 'Props must be an array'
          }
        ]
      }
    }
  })
  @HasPermission(GameChannelAPIPolicy, 'putStorage')
  async putStorage(req: Request<PutStorageRequest> ): Promise<Response<PutStorageResponse>> {
    const { props } = req.body
    const em: EntityManager = req.ctx.em

    const channel: GameChannel = req.ctx.state.channel

    if (!channel.hasMember(req.ctx.state.alias.id)) {
      req.ctx.throw(403, 'This player is not a member of the channel')
    }

    const {
      upsertedProps,
      deletedProps,
      failedProps
    } = await em.transactional(async (em): Promise<GameChannelStorageTransaction> => {
      const newPropsMap = new Map(sanitiseProps(props).map(({ key, value }) => [key, value]))

      const upsertedProps: GameChannelStorageTransaction['upsertedProps'] = []
      const deletedProps: GameChannelStorageTransaction['deletedProps'] = []
      const failedProps: GameChannelStorageTransaction['failedProps'] = []

      if (newPropsMap.size === 0) {
        return {
          upsertedProps,
          deletedProps,
          failedProps
        }
      }

      const existingStorageProps = await em.repo(GameChannelStorageProp).find({
        gameChannel: channel,
        key: {
          $in: Array.from(newPropsMap.keys())
        }
      }, { lockMode: LockMode.PESSIMISTIC_WRITE })

      for (const existingProp of existingStorageProps) {
        const newPropValue = newPropsMap.get(existingProp.key)
        newPropsMap.delete(existingProp.key)

        if (!newPropValue) {
          // delete the existing prop and track who deleted it
          em.remove(existingProp)
          existingProp.lastUpdatedBy = req.ctx.state.alias
          existingProp.updatedAt = new Date()
          deletedProps.push(existingProp)
          continue
        } else {
          try {
            testPropSize(existingProp.key, newPropValue)
          } catch (error) {
            if (error instanceof PropSizeError) {
              failedProps.push({ key: existingProp.key, error: error.message })
              continue
            /* v8 ignore next 3 */
            } else {
              throw error
            }
          }

          // update the existing prop
          existingProp.value = String(newPropValue)
          existingProp.lastUpdatedBy = req.ctx.state.alias
          newPropsMap.delete(existingProp.key)
          upsertedProps.push(existingProp)
        }
      }

      for (const [key, value] of newPropsMap.entries()) {
        if (value) {
          try {
            testPropSize(key, value)
          } catch (error) {
            if (error instanceof PropSizeError) {
              failedProps.push({ key, error: error.message })
              continue
            /* v8 ignore next 3 */
            } else {
              throw error
            }
          }

          // create a new prop
          const newProp = new GameChannelStorageProp(channel, key, String(value))
          newProp.createdBy = req.ctx.state.alias
          newProp.lastUpdatedBy = req.ctx.state.alias
          em.persist(newProp)
          upsertedProps.push(newProp)
        }
      }

      await em.flush()

      const redis: Redis = req.ctx.redis
      for (const prop of upsertedProps) {
        await prop.persistToRedis(redis)
      }
      for (const prop of deletedProps) {
        const redisKey = GameChannelStorageProp.getRedisKey(channel.id, prop.key)
        const expirationSeconds = GameChannelStorageProp.redisExpirationSeconds
        await redis.set(redisKey, 'null', 'EX', expirationSeconds)
      }

      return {
        upsertedProps,
        deletedProps,
        failedProps
      }
    })

    await channel.sendMessageToMembers(req.ctx.wss, 'v1.channels.storage.updated', {
      channel,
      upsertedProps,
      deletedProps
    })

    return {
      status: 200,
      body: {
        channel,
        upsertedProps,
        deletedProps,
        failedProps
      }
    }
  }
}
