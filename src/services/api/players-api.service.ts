import { EntityManager } from '@mikro-orm/core'
import { Request, Response, Routes, Validate, HasPermission } from 'koa-clay'
import APIKey, { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import PlayerAlias from '../../entities/player-alias'
import PlayerAPIPolicy from '../../policies/api/players-api.policy'
import PlayerService from '../players.service'
import APIService from './api-service'
import uniqWith from 'lodash.uniqwith'

@Routes([
  {
    method: 'GET',
    handler: 'index'
  },
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify'
  },
  {
    method: 'POST'
  },
  {
    method: 'PATCH'
  },
  {
    method: 'POST',
    path: '/merge',
    handler: 'merge'
  }
])
export default class PlayerAPIService extends APIService<PlayerService> {
  constructor() {
    super('players')
  }

  @Validate({
    query: ['service', 'identifier']
  })
  @HasPermission(PlayerAPIPolicy, 'identify')
  async identify(req: Request): Promise<Response> {
    const { service, identifier } = req.query
    const em: EntityManager = req.ctx.em

    const key: APIKey = await this.getAPIKey(req.ctx)

    const alias = await em.getRepository(PlayerAlias).findOne({
      service,
      identifier,
      player: {
        game: key.game
      }
    })

    if (!alias) {
      if (req.ctx.state.key.scopes.includes(APIKeyScope.WRITE_PLAYERS)) {
        const createReq = Object.assign(req, {
          body: {
            aliases: [
              {
                service,
                identifier
              }
            ]
          }
        })

        const res = await this.post(createReq)

        return {
          status: res.status,
          body: {
            alias: res.body.player?.aliases[0]
          }
        }
      } else {
        req.ctx.throw(404, 'Player not found')
      }
    }

    alias.player.lastSeenAt = new Date()
    await em.flush()

    return {
      status: 200,
      body: {
        alias
      }
    }
  }

  @HasPermission(PlayerAPIPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.query = {
      gameId: key.game.id.toString()
    }

    return await this.forwardRequest('index', req)
  }

  @HasPermission(PlayerAPIPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const key: APIKey = await this.getAPIKey(req.ctx)
    req.body = {
      ...req.body,
      gameId: key.game.id
    }

    return await this.forwardRequest('post', req)
  }

  @HasPermission(PlayerAPIPolicy, 'patch')
  async patch(req: Request): Promise<Response> {
    return await this.forwardRequest('patch', req)
  }

   @Validate({
     body: ['alias1', 'alias2']
   })
  @HasPermission(PlayerAPIPolicy, 'merge')
  async merge(req: Request): Promise<Response> {
    const { alias1, alias2 } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const player1 = await em.getRepository(Player).findOne({
      aliases: {
        id: alias1
      },
      game: key.game
    }, ['aliases'])

    const player2 = await em.getRepository(Player).findOne({
      aliases: {
        id: alias2
      },
      game: key.game
    }, ['aliases'])

    player2.aliases
      .getItems()
      .map((alias) => alias.player = player1)

    const mergedProps = uniqWith([
      ...player2.props,
      ...player1.props
    ], (a, b) => a.key === b.key)

    player1.props = Array.from(mergedProps)

    await em.remove(player2)
    await em.flush()

    return {
      status: 200,
      body: {
        player: player1
      }
    }
  }
}
