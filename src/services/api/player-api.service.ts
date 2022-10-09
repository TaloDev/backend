import { EntityManager } from '@mikro-orm/core'
import { Request, Response, Routes, Validate, HasPermission, ForwardTo, forwardRequest } from 'koa-clay'
import APIKey, { APIKeyScope } from '../../entities/api-key'
import Player from '../../entities/player'
import PlayerAlias from '../../entities/player-alias'
import PlayerAPIPolicy from '../../policies/api/player-api.policy'
import APIService from './api-service'
import uniqWith from 'lodash.uniqwith'
import PlayerAPIDocs from '../../docs/player-api.docs'
import PlayerProp from '../../entities/player-prop'

@Routes([
  {
    method: 'GET',
    path: '/identify',
    handler: 'identify',
    docs: PlayerAPIDocs.identify
  },
  {
    method: 'PATCH',
    path: '/:aliasId',
    docs: PlayerAPIDocs.patch
  },
  {
    method: 'POST',
    path: '/merge',
    handler: 'merge',
    docs: PlayerAPIDocs.merge
  }
])
export default class PlayerAPIService extends APIService {
  @Validate({
    query: ['service', 'identifier']
  })
  @HasPermission(PlayerAPIPolicy, 'identify')
  @ForwardTo('games.players', 'post')
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
        req.ctx.state.game = key.game

        const res = await forwardRequest(req, {
          body: {
            aliases: [
              {
                service,
                identifier
              }
            ]
          }
        })

        return {
          status: res.status,
          body: {
            alias: res.body.player?.aliases[0]
          }
        }
      } else {
        req.ctx.throw(404, 'Player not found. Use an access key with the write:players scope to automatically create players')
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

  @HasPermission(PlayerAPIPolicy, 'patch')
  @ForwardTo('games.players', 'patch')
  async patch(req: Request): Promise<Response> {
    return await forwardRequest(req)
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
    })

    if (!player1) req.ctx.throw(404, `Player with alias ${alias1} does not exist`)

    const player2 = await em.getRepository(Player).findOne({
      aliases: {
        id: alias2
      },
      game: key.game
    })

    if (!player2) req.ctx.throw(404, `Player with alias ${alias2} does not exist`)

    const player2Aliases = await em.getRepository(PlayerAlias).find({
      player: {
        id: player2.id
      }
    })

    player2Aliases.forEach((alias) => alias.player = player1)

    const mergedProps: PlayerProp[] = uniqWith([
      ...player2.props.getItems(),
      ...player1.props.getItems()
    ], (a, b) => a.key === b.key)

    player1.setProps(mergedProps)

    await em.removeAndFlush(player2)

    return {
      status: 200,
      body: {
        player: player1
      }
    }
  }
}
