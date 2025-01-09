import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import { uniqWith } from 'lodash'
import Game from '../entities/game'
import { GameActivityType } from '../entities/game-activity'
import GameSecret from '../entities/game-secret'
import getUserFromToken from '../lib/auth/getUserFromToken'
import createGameActivity from '../lib/logging/createGameActivity'
import sanitiseProps from '../lib/props/sanitiseProps'
import GamePolicy from '../policies/game.policy'
import Socket from '../socket'
import { sendMessages } from '../socket/messages/socketMessage'
import { APIKeyScope } from '../entities/api-key'

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
  @Validate({
    body: ['name']
  })
  @HasPermission(GamePolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { name } = req.body
    const em: EntityManager = req.ctx.em
    const user = await getUserFromToken(req.ctx)

    const game = new Game(name, user.organisation)
    game.apiSecret = new GameSecret()
    await em.persistAndFlush(game)

    return {
      status: 200,
      body: {
        game
      }
    }
  }

  @HasPermission(GamePolicy, 'patch')
  async patch(req: Request): Promise<Response> {
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
        req.ctx.throw(400, 'Prop keys starting with \'META_\' are reserved for internal systems, please use another key name')
      }

      const mergedProps = uniqWith([
        ...sanitiseProps(props),
        ...game.props
      ], (a, b) => a.key === b.key)

      game.props = sanitiseProps(mergedProps, true)
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
