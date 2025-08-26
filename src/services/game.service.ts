import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Route } from 'koa-clay'
import Game from '../entities/game'
import { GameActivityType } from '../entities/game-activity'
import GameSecret from '../entities/game-secret'
import getUserFromToken from '../lib/auth/getUserFromToken'
import createGameActivity from '../lib/logging/createGameActivity'
import { mergeAndSanitiseProps, sanitiseProps } from '../lib/props/sanitiseProps'
import GamePolicy from '../policies/game.policy'
import Socket from '../socket'
import { sendMessages } from '../socket/messages/socketMessage'
import { APIKeyScope } from '../entities/api-key'
import Prop from '../entities/prop'
import { PropSizeError } from '../lib/errors/propSizeError'
import buildErrorResponse from '../lib/errors/buildErrorResponse'
import { UserType } from '../entities/user'
import { TraceService } from '../lib/tracing/trace-service'

async function sendLiveConfigUpdatedMessage(req: Request, game: Game) {
  const socket: Socket = req.ctx.wss
  const conns = socket.findConnections((conn) => {
    return conn.game.id === game.id && conn.hasScope(APIKeyScope.READ_GAME_CONFIG)
  })
  await sendMessages(conns, 'v1.live-config.updated', {
    config: game.getLiveConfig()
  })
}

function throwUnlessOwner(req: Request) {
  if (req.ctx.state.user.type !== UserType.OWNER) {
    req.ctx.throw(403, 'You do not have permissions to update game settings')
  }
}

@TraceService()
export default class GameService extends Service {
  @Route({
    method: 'GET',
    path: '/:id/settings'
  })
  @HasPermission(GamePolicy, 'settings')
  async settings(req: Request): Promise<Response> {
    const game: Game = req.ctx.state.game

    return {
      status: 200,
      body: {
        settings: {
          purgeDevPlayers: game.purgeDevPlayers,
          purgeLivePlayers: game.purgeLivePlayers,
          purgeDevPlayersRetention: game.purgeDevPlayersRetention,
          purgeLivePlayersRetention: game.purgeLivePlayersRetention,
          website: game.website
        }
      }
    }
  }

  @Route({
    method: 'POST'
  })
  @Validate({
    body: ['name']
  })
  @HasPermission(GamePolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name } = req.body
    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)

    const game = new Game(name, user.organisation)
    try {
      game.apiSecret = new GameSecret()
    } catch (err) {
      req.ctx.throw(500, (err as Error).message)
    }
    await em.persistAndFlush(game)

    return {
      status: 200,
      body: {
        game
      }
    }
  }

  @Route({
    method: 'PATCH',
    path: '/:id'
  })
  @HasPermission(GamePolicy, 'patch')
  async patch(req: Request<{
    name?: string
    props?: Prop[]
    purgeDevPlayers?: boolean
    purgeLivePlayers?: boolean
    purgeDevPlayersRetention?: boolean
    purgeLivePlayersRetention?: boolean
    website?: string
  }>): Promise<Response> {
    const {
      name,
      props,
      purgeDevPlayers,
      purgeLivePlayers,
      purgeDevPlayersRetention,
      purgeLivePlayersRetention,
      website
    } = req.body

    const em: EntityManager = req.ctx.em

    const game: Game = req.ctx.state.game

    if (typeof name === 'string') {
      const prevName = game.name
      game.name = name

      createGameActivity(em, {
        user: req.ctx.state.user,
        game,
        type: GameActivityType.GAME_NAME_UPDATED,
        extra: {
          display: {
            'Previous name': prevName
          }
        }
      })
    }

    if (Array.isArray(props)) {
      if (props.some((prop) => prop.key.startsWith('META_'))) {
        return buildErrorResponse({ props: ['Prop keys starting with \'META_\' are reserved for internal systems, please use another key name'] })
      }

      try {
        game.props = mergeAndSanitiseProps(game.props, props)
      } catch (err) {
        if (err instanceof PropSizeError) {
          return buildErrorResponse({ props: [err.message] })
        /* v8 ignore start */
        }
        throw err
        /* v8 ignore stop */
      }

      await em.clearCache(Game.getLiveConfigCacheKey(game))
      await sendLiveConfigUpdatedMessage(req, game)

      createGameActivity(em, {
        user: req.ctx.state.user,
        game,
        type: GameActivityType.GAME_PROPS_UPDATED,
        extra: {
          display: {
            'Updated props': sanitiseProps(props).map((prop) => `${prop.key}: ${prop.value ?? '[deleted]'}`).join(', ')
          }
        }
      })
    }

    if (typeof purgeDevPlayers === 'boolean') {
      throwUnlessOwner(req)
      game.purgeDevPlayers = purgeDevPlayers
    }
    if (typeof purgeLivePlayers === 'boolean') {
      throwUnlessOwner(req)
      game.purgeLivePlayers = purgeLivePlayers
    }
    if (typeof purgeDevPlayersRetention === 'number') {
      throwUnlessOwner(req)
      game.purgeDevPlayersRetention = purgeDevPlayersRetention
    }
    if (typeof purgeLivePlayersRetention === 'number') {
      throwUnlessOwner(req)
      game.purgeLivePlayersRetention = purgeLivePlayersRetention
    }

    if (typeof website === 'string') {
      throwUnlessOwner(req)
      game.website = website
    }

    await em.flush()

    return {
      status: 200,
      body: {
        game
      }
    }
  }
}
