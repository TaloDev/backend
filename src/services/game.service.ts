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

async function sendLiveConfigUpdatedMessage(req: Request, game: Game) {
  const socket: Socket = req.ctx.wss
  const conns = socket.findConnections((conn) => {
    return conn.game.id === game.id && conn.hasScope(APIKeyScope.READ_GAME_CONFIG)
  })
  await sendMessages(conns, 'v1.live-config.updated', {
    config: game.getLiveConfig()
  })
}

export default class GameService extends Service {
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
  async patch(req: Request<{ name: string, props: Prop[] }>): Promise<Response> {
    const { name, props } = req.body
    const em: EntityManager = req.ctx.em

    const game: Game = req.ctx.state.game

    if (name) {
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

    if (props) {
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
        /* v8 ignore end */
      }
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

    await em.flush()

    return {
      status: 200,
      body: {
        game
      }
    }
  }
}
