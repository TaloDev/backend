import { apiRouter, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import Game from '../../../entities/game'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions'
import { RouteDocs } from '../../../lib/docs/docs-registry'

export function gameConfigAPIRouter() {
  return apiRouter('/v1/game-config', ({ route }) => {
    route({
      method: 'get',
      docs,
      middleware: withMiddleware(requireScopes([APIKeyScope.READ_GAME_CONFIG])),
      handler: async (ctx) => {
        const key = ctx.state.key
        const cacheKey = Game.getLiveConfigCacheKey(key.game)

        const game = await ctx.em
          .fork()
          .repo(Game)
          .findOneOrFail(key.game, {
            ...getResultCacheOptions(cacheKey, 600_000),
            fields: ['props']
          })

        return {
          status: 200,
          body: {
            config: game.getLiveConfig()
          }
        }
      }
    })
  }, {
    docsKey: 'GameConfigAPI'
  })
}

const docs = {
  description: 'Get the live config for the game',
  samples: [
    {
      title: 'Sample response',
      sample: {
        config: [
          { key: 'xpRate', value: '1.5' },
          { key: 'maxLevel', value: '80' },
          { key: 'halloweenEventEnabled', value: 'false' }
        ]
      }
    }
  ]
} satisfies RouteDocs
