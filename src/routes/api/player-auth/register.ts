import { apiRoute, withMiddleware } from '../../../lib/routing/router'
import { requireScopes } from '../../../middleware/policy-middleware'
import { APIKeyScope } from '../../../entities/api-key'
import { PlayerAliasService } from '../../../entities/player-alias'
import { createPlayerFromIdentifyRequest, PlayerCreationError } from '../../../lib/players/createPlayer'
import { PricingPlanLimitError } from '../../../lib/billing/checkPricingPlanPlayerLimit'
import PlayerAuth from '../../../entities/player-auth'
import bcrypt from 'bcrypt'
import emailRegex from '../../../lib/lang/emailRegex'
import { createPlayerAuthActivity } from './common'
import { PlayerAuthActivityType } from '../../../entities/player-auth-activity'
import { registerDocs } from './docs'

export const registerRoute = apiRoute({
  method: 'post',
  path: '/register',
  docs: registerDocs,
  schema: (z) => ({
    body: z.object({
      identifier: z.string().meta({ description: 'The unique identifier of the player. This can be their username, an email or a numeric ID' }),
      password: z.string().meta({ description: 'The password the player will login with' }),
      verificationEnabled: z.boolean().optional().meta({ description: 'When enabled, the player will be sent a verification code to their email address before they can login' }),
      email: z.string().optional().meta({ description: 'Required when verification is enabled. This is also used for password resets: players without an email cannot reset their password' })
    }).refine(
      (data) => !data.verificationEnabled || data.email,
      { message: 'email is required when verificationEnabled is true', path: ['email'] }
    )
  }),
  middleware: withMiddleware(
    requireScopes([APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS])
  ),
  handler: async (ctx) => {
    const { identifier, password, email, verificationEnabled } = ctx.state.validated.body
    const em = ctx.em

    const key = ctx.state.key

    const devBuild = ctx.request.headers['x-talo-dev-build'] === '1'
    let player
    try {
      player = await createPlayerFromIdentifyRequest({
        em,
        key,
        service: PlayerAliasService.TALO,
        identifier,
        devBuild
      })
    } catch (err) {
      if (err instanceof PlayerCreationError) {
        ctx.throw(err.statusCode, {
          message: err.message,
          errorCode: err.errorCode
        })
      }
      if (err instanceof PricingPlanLimitError) {
        ctx.throw(402, err.message)
      }
      throw err
    }
    const alias = player?.aliases[0]

    alias.player.auth = new PlayerAuth()
    alias.player.auth.password = await bcrypt.hash(password, 10)

    if (email?.trim()) {
      const sanitisedEmail = email.trim().toLowerCase()
      if (emailRegex.test(sanitisedEmail)) {
        alias.player.auth.email = sanitisedEmail
      } else {
        ctx.throw(400, {
          message: 'Invalid email address',
          errorCode: 'INVALID_EMAIL'
        })
      }
    } else {
      alias.player.auth.email = null
    }

    alias.player.auth.verificationEnabled = Boolean(verificationEnabled)
    em.persist(alias.player.auth)

    const sessionToken = await alias.player.auth.createSession(alias)
    const socketToken = await alias.createSocketToken(ctx.redis)

    createPlayerAuthActivity(ctx, alias.player, {
      type: PlayerAuthActivityType.REGISTERED,
      extra: {
        verificationEnabled: alias.player.auth.verificationEnabled
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        alias,
        sessionToken,
        socketToken
      }
    }
  }
})
