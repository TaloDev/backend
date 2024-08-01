import { EntityManager } from '@mikro-orm/mysql'
import { Request, Response, Routes, Validate, HasPermission, ForwardTo } from 'koa-clay'
import APIKey from '../../entities/api-key'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import APIService from './api-service'
import { createPlayerFromIdentifyRequest, findAliasFromIdentifyRequest } from './player-api.service'
import PlayerAuth, { PlayerAuthErrorCode } from '../../entities/player-auth'
import bcrypt from 'bcrypt'
import PlayerAuthAPIPolicy from '../../policies/api/player-auth-api.policy'
import PlayerAuthAPIDocs from '../../docs/player-auth-api.docs'
import { createRedisConnection } from '../../config/redis.config'
import generateSixDigitCode from '../../lib/auth/generateSixDigitCode'
import queueEmail from '../../lib/messaging/queueEmail'
import PlayerAuthCode from '../../emails/player-auth-code-mail'
import PlayerAuthResetPassword from '../../emails/player-auth-reset-password-mail'
import createPlayerAuthActivity from '../../lib/logging/createPlayerAuthActivity'
import { PlayerAuthActivityType } from '../../entities/player-auth-activity'

@Routes([
  {
    method: 'POST',
    path: '/register',
    handler: 'register',
    docs: PlayerAuthAPIDocs.register
  },
  {
    method: 'POST',
    path: '/login',
    handler: 'login',
    docs: PlayerAuthAPIDocs.login
  },
  {
    method: 'POST',
    path: '/verify',
    handler: 'verify',
    docs: PlayerAuthAPIDocs.verify
  },
  {
    method: 'POST',
    path: '/logout',
    handler: 'logout',
    docs: PlayerAuthAPIDocs.logout
  },
  {
    method: 'POST',
    path: '/change_password',
    handler: 'changePassword',
    docs: PlayerAuthAPIDocs.changePassword
  },
  {
    method: 'POST',
    path: '/change_email',
    handler: 'changeEmail',
    docs: PlayerAuthAPIDocs.changeEmail
  },
  {
    method: 'POST',
    path: '/forgot_password',
    handler: 'forgotPassword',
    docs: PlayerAuthAPIDocs.forgotPassword
  },
  {
    method: 'POST',
    path: '/reset_password',
    handler: 'resetPassword',
    docs: PlayerAuthAPIDocs.resetPassword
  },
  {
    method: 'PATCH',
    path: '/toggle_verification',
    handler: 'toggleVerification',
    docs: PlayerAuthAPIDocs.toggleVerification
  }
])
export default class PlayerAuthAPIService extends APIService {
  @Validate({
    body: {
      identifier: {
        required: true
      },
      password: {
        required: true
      },
      email: {
        requiredIf: async (req: Request) => Boolean(req.body.verificationEnabled)
      }
    }
  })
  @HasPermission(PlayerAuthAPIPolicy, 'register')
  @ForwardTo('games.players', 'post')
  async register(req: Request): Promise<Response> {
    const { identifier, password, email, verificationEnabled } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const player = await createPlayerFromIdentifyRequest(req, key, PlayerAliasService.TALO, identifier)
    const alias = player?.aliases[0]

    alias.player.auth = new PlayerAuth()
    alias.player.auth.password = await bcrypt.hash(password, 10)
    alias.player.auth.email = email || null
    alias.player.auth.verificationEnabled = Boolean(verificationEnabled)
    em.persist(alias.player.auth)

    const sessionToken = await alias.player.auth.createSession(alias)

    createPlayerAuthActivity(req, alias.player, {
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
        sessionToken
      }
    }
  }

  private handleFailedLogin(req: Request) {
    req.ctx.throw(401, { message: 'Incorrect identifier or password', errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS })
  }

  private getRedisAuthKey(key: APIKey, alias: PlayerAlias): string {
    return `player-auth:${key.game.id}:verification:${alias.id}`
  }

  private getRedisPasswordResetKey(key: APIKey, code: string): string {
    return `player-auth:${key.game.id}:password-reset:${code}`
  }

  @Validate({
    body: ['identifier', 'password']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'login')
  async login(req: Request): Promise<Response> {
    const { identifier, password } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const alias = await findAliasFromIdentifyRequest(em, key, PlayerAliasService.TALO, identifier)
    if (!alias) this.handleFailedLogin(req)

    const passwordMatches = await bcrypt.compare(password, alias.player.auth.password)
    if (!passwordMatches) this.handleFailedLogin(req)

    if (alias.player.auth.verificationEnabled) {
      const redis = createRedisConnection(req.ctx)

      await em.populate(alias.player, ['game'])

      const code = generateSixDigitCode()
      await redis.set(this.getRedisAuthKey(key, alias), code, 'EX', 300)
      await queueEmail(req.ctx.emailQueue, new PlayerAuthCode(alias, code))

      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.VERIFICATION_STARTED
      })

      await em.flush()

      return {
        status: 200,
        body: {
          aliasId: alias.id,
          verificationRequired: true
        }
      }
    } else {
      const sessionToken = await alias.player.auth.createSession(alias)

      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.LOGGED_IN
      })

      await em.flush()

      return {
        status: 200,
        body: {
          alias,
          sessionToken
        }
      }
    }
  }

  @Validate({
    body: ['aliasId', 'code']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'verify')
  async verify(req: Request): Promise<Response> {
    const { aliasId, code } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const alias = await em.getRepository(PlayerAlias).findOne(aliasId, {
      populate: ['player.auth']
    })

    if (!alias) {
      req.ctx.throw(403, {
        message: 'Player alias not found',
        errorCode: PlayerAuthErrorCode.VERIFICATION_ALIAS_NOT_FOUND
      })
    }

    const redis = createRedisConnection(req.ctx)
    const redisCode = await redis.get(this.getRedisAuthKey(key, alias))

    if (!redisCode || code !== redisCode) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.VERIFICATION_FAILED
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Invalid code',
        errorCode: PlayerAuthErrorCode.VERIFICATION_CODE_INVALID
      })
    }

    await redis.del(this.getRedisAuthKey(key, alias))

    const sessionToken = await alias.player.auth.createSession(alias)

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.LOGGED_IN
    })

    await em.flush()

    return {
      status: 200,
      body: {
        alias,
        sessionToken
      }
    }
  }
  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'logout')
  async logout(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOne(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    alias.player.auth.sessionKey = null
    alias.player.auth.sessionCreatedAt = null

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.LOGGED_OUT
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword', 'newPassword']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'changePassword')
  async changePassword(req: Request): Promise<Response> {
    const { currentPassword, newPassword } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOne(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
        extra: {
          errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS
      })
    }

    const isSamePassword = await bcrypt.compare(newPassword, alias.player.auth.password)
    if (isSamePassword) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
        extra: {
          errorCode: PlayerAuthErrorCode.NEW_PASSWORD_MATCHES_CURRENT_PASSWORD
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'Please choose a different password',
        errorCode: PlayerAuthErrorCode.NEW_PASSWORD_MATCHES_CURRENT_PASSWORD
      })
    }

    alias.player.auth.password = await bcrypt.hash(newPassword, 10)

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.CHANGED_PASSWORD
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword', 'newEmail']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'changeEmail')
  async changeEmail(req: Request): Promise<Response> {
    const { currentPassword, newEmail } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOne(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS
      })
    }

    const isSameEmail = newEmail === alias.player.auth.email
    if (isSameEmail) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: PlayerAuthErrorCode.NEW_EMAIL_MATCHES_CURRENT_EMAIL
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'Please choose a different email address',
        errorCode: PlayerAuthErrorCode.NEW_EMAIL_MATCHES_CURRENT_EMAIL
      })
    }

    const oldEmail = alias.player.auth.email
    alias.player.auth.email = newEmail

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.CHANGED_EMAIL,
      extra: {
        oldEmail
      }
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Validate({
    body: ['email']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'forgotPassword')
  async forgotPassword(req: Request): Promise<Response> {
    const { email } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const playerAuth = await em.getRepository(PlayerAuth).findOne({
      email,
      player: {
        game: key.game
      }
    }, {
      populate: ['player.aliases', 'player.game']
    })

    if (playerAuth) {
      const redis = createRedisConnection(req.ctx)
      const alias = playerAuth.player.aliases.find((alias) => alias.service === PlayerAliasService.TALO)
      const key = await this.getAPIKey(req.ctx)

      const code = generateSixDigitCode()
      await redis.set(this.getRedisPasswordResetKey(key, code), alias.id, 'EX', 900)
      await queueEmail(req.ctx.emailQueue, new PlayerAuthResetPassword(alias, code))

      createPlayerAuthActivity(req, playerAuth.player, {
        type: PlayerAuthActivityType.PASSWORD_RESET_REQUESTED
      })

      await em.flush()
    }

    return {
      status: 204
    }
  }

  @Validate({
    body: ['password', 'code']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'resetPassword')
  async resetPassword(req: Request): Promise<Response> {
    const { password, code } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const redis = createRedisConnection(req.ctx)
    const aliasId = await redis.get(this.getRedisPasswordResetKey(key, code))
    const alias = await em.getRepository(PlayerAlias).findOne({
      id: Number(aliasId),
      player: {
        game: key.game
      }
    }, {
      populate: ['player.auth']
    })

    if (!aliasId || !alias) {
      req.ctx.throw(401, {
        message: 'This code is either invalid or has expired',
        errorCode: PlayerAuthErrorCode.PASSWORD_RESET_CODE_INVALID
      })
    }

    await redis.del(this.getRedisPasswordResetKey(key, code))

    alias.player.auth.password = await bcrypt.hash(password, 10)
    alias.player.auth.sessionKey = null
    alias.player.auth.sessionCreatedAt = null

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.PASSWORD_RESET_COMPLETED
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword', 'verificationEnabled']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'toggleVerification')
  async toggleVerification(req: Request): Promise<Response> {
    const { currentPassword, verificationEnabled, email } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOne(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    if (verificationEnabled && !alias.player.auth.email && !email) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
        extra: {
          errorCode: PlayerAuthErrorCode.VERIFICATION_EMAIL_REQUIRED,
          verificationEnabled: Boolean(verificationEnabled)
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'An email address is required to enable verification',
        errorCode: PlayerAuthErrorCode.VERIFICATION_EMAIL_REQUIRED
      })
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
        extra: {
          errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS,
          verificationEnabled: Boolean(verificationEnabled)
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: PlayerAuthErrorCode.INVALID_CREDENTIALS
      })
    }

    alias.player.auth.verificationEnabled = Boolean(verificationEnabled)
    if (email?.trim()) {
      alias.player.auth.email = email
    }

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.VERFICIATION_TOGGLED,
      extra: {
        verificationEnabled: alias.player.auth.verificationEnabled
      }
    })

    await em.flush()

    return {
      status: 204
    }
  }
}
