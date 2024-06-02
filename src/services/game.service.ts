import { EntityManager } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate } from 'koa-clay'
import uniqWith from 'lodash.uniqwith'
import Game from '../entities/game.js'
import { GameActivityType } from '../entities/game-activity.js'
import GameSecret from '../entities/game-secret.js'
import getUserFromToken from '../lib/auth/getUserFromToken.js'
import createGameActivity from '../lib/logging/createGameActivity.js'
import sanitiseProps from '../lib/props/sanitiseProps.js'
import GamePolicy from '../policies/game.policy.js'

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
    const { props } = req.body
    const em: EntityManager = req.ctx.em

    const game: Game = req.ctx.state.game

    if (props) {
      if (props.some((prop) => prop.key.startsWith('META_'))) {
        req.ctx.throw(400, 'Prop keys starting with \'META_\' are reserved for internal systems, please use another key name')
      }

      const mergedProps = uniqWith([
        ...sanitiseProps(props),
        ...game.props
      ], (a, b) => a.key === b.key)

      game.props = sanitiseProps(mergedProps, true)

      await createGameActivity(em, {
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
