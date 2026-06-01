import { GameActivityType } from '../../../entities/game-activity.js'
import GameVerificationKey from '../../../entities/game-verification-key.js'
import { UserType } from '../../../entities/user.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import { userTypeGate } from '../../../middleware/policy-middleware.js'

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      version: z.string().min(1).max(255),
      value: z.string().min(1).max(100),
    }),
  }),
  middleware: withMiddleware(userTypeGate([UserType.ADMIN], 'create verification keys'), loadGame),
  handler: async (ctx) => {
    const { version, value } = ctx.state.validated.body
    const em = ctx.em

    const existingCount = await em.repo(GameVerificationKey).count({
      game: ctx.state.game,
      version,
    })

    if (existingCount > 0) {
      return ctx.throw(409, `Verification key version "${version}" already exists`)
    }

    await em.populate(ctx.state.game, ['apiSecret'])
    const encrypted = GameVerificationKey.encryptValue(value, ctx.state.game.apiSecret)

    const verificationKey = new GameVerificationKey()
    verificationKey.game = ctx.state.game
    verificationKey.version = version
    verificationKey.value = encrypted

    createGameActivity(em, {
      user: ctx.state.user,
      game: ctx.state.game,
      type: GameActivityType.VERIFICATION_KEY_CREATED,
      extra: {
        version,
      },
    })

    await em.persist(verificationKey).flush()

    return {
      status: 200,
      body: {
        verificationKey,
      },
    }
  },
})
