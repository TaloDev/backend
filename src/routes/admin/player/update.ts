import { AdminAPIKeyScope } from '../../../entities/admin-api-key.js'
import { adminRoute, withMiddleware } from '../../../lib/routing/router.js'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { requireAdminScopes } from '../../../middleware/policy-middleware.js'
import { toggleDevBuildHandler } from '../../protected/player/toggle-dev-build.js'
import { updatePlayerHandler } from '../../protected/player/update.js'
import { loadPlayer } from './common.js'
import { updateDocs } from './docs.js'

export const updatePlayerAdminRoute = adminRoute({
  method: 'patch',
  path: '/:id',
  docs: updateDocs,
  schema: (z) => ({
    route: z.object({
      id: z.string().meta({ description: 'The ID of the player' }),
    }),
    body: z.object({
      props: updatePropsSchema.optional().meta({
        description:
          "An array of props. Props that the player doesn't have will be added. Props with updated values will overwrite existing props. Props with a null value will be deleted from the player",
      }),
      devBuild: z.boolean().optional().meta({ description: 'Mark the player as a dev build' }),
    }),
  }),
  middleware: withMiddleware(requireAdminScopes([AdminAPIKeyScope.WRITE_PLAYERS]), loadPlayer),
  handler: async (ctx) =>
    ctx.em.transactional(async (trx) => {
      const { props, devBuild } = ctx.state.validated.body
      const player = ctx.state.player
      const actor = ctx.state.key

      if (devBuild !== undefined) {
        await toggleDevBuildHandler({
          em: trx,
          game: ctx.state.game,
          player,
          actor,
          devBuild,
        })
      }

      return updatePlayerHandler({ em: trx, player, props, actor })
    }),
})
