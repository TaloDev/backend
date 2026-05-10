import { APIKeyScope } from '../../../entities/api-key.js'
import Game from '../../../entities/game.js'
import { RouteDocs } from '../../../lib/docs/docs-registry.js'
import { getResultCacheOptions } from '../../../lib/perf/getResultCacheOptions.js'
import { apiRouter, withMiddleware } from '../../../lib/routing/router.js'
import { requireScopes } from '../../../middleware/policy-middleware.js'

export function gameConfigAPIRouter() {
  return apiRouter(
    '/v1/game-config',
    ({ route }) => {
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
              fields: ['props'],
            })

          return {
            status: 200,
            body: {
              config: game.getLiveConfig(),
            },
          }
        },
      })
    },
    {
      docsKey: 'GameConfigAPI',
    },
  )
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
          { key: 'halloweenEventEnabled', value: 'false' },
        ],
      },
    },
  ],
} satisfies RouteDocs
