import { EntityManager } from '@mikro-orm/mysql'
import { Request, Response, Route, Validate, HasPermission, ForwardTo } from 'koa-clay'
import APIKey from '../../entities/api-key'
import PlayerAlias, { PlayerAliasService } from '../../entities/player-alias'
import APIService from './api-service'
import { createPlayerFromIdentifyRequest, findAliasFromIdentifyRequest } from './player-api.service'
import PlayerAuth from '../../entities/player-auth'
import bcrypt from 'bcrypt'
import PlayerAuthAPIPolicy from '../../policies/api/player-auth-api.policy'
import PlayerAuthAPIDocs from '../../docs/player-auth-api.docs'
import generateSixDigitCode from '../../lib/auth/generateSixDigitCode'
import queueEmail from '../../lib/messaging/queueEmail'
import PlayerAuthCode from '../../emails/player-auth-code-mail'
import PlayerAuthResetPassword from '../../emails/player-auth-reset-password-mail'
import createPlayerAuthActivity from '../../lib/logging/createPlayerAuthActivity'
import PlayerAuthActivity, { PlayerAuthActivityType } from '../../entities/player-auth-activity'
import emailRegex from '../../lib/lang/emailRegex'
import { deleteClickHousePlayerData } from '../../tasks/deleteInactivePlayers'
import Redis from 'ioredis'
import assert from 'node:assert'
import { getGlobalQueue } from '../../config/global-queues'

export default class PlayerAuthAPIService extends APIService {
  @Route({
    method: 'POST',
    path: '/register',
    docs: PlayerAuthAPIDocs.register
  })
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

    if (email?.trim()) {
      const sanitisedEmail = email.trim().toLowerCase()
      if (emailRegex.test(sanitisedEmail)) {
        alias.player.auth.email = sanitisedEmail
      } else {
        req.ctx.throw(400, {
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
    const socketToken = await alias.createSocketToken(req.ctx.redis)

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
        sessionToken,
        socketToken
      }
    }
  }

  private handleFailedLogin(req: Request) {
    return req.ctx.throw(401, { message: 'Incorrect identifier or password', errorCode: 'INVALID_CREDENTIALS' })
  }

  private getRedisAuthKey(key: APIKey, alias: PlayerAlias): string {
    return `player-auth:${key.game.id}:verification:${alias.id}`
  }

  private getRedisPasswordResetKey(key: APIKey, code: string): string {
    return `player-auth:${key.game.id}:password-reset:${code}`
  }

  @Route({
    method: 'POST',
    path: '/login',
    docs: PlayerAuthAPIDocs.login
  })
  @Validate({
    body: ['identifier', 'password']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'login')
  async login(req: Request): Promise<Response> {
    const { identifier, password } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const alias = await findAliasFromIdentifyRequest(req, key, PlayerAliasService.TALO, identifier)
    if (!alias) return this.handleFailedLogin(req)

    await em.populate(alias, ['player.auth'])
    if (!alias.player.auth) return this.handleFailedLogin(req)

    const passwordMatches = await bcrypt.compare(password, alias.player.auth.password)
    if (!passwordMatches) this.handleFailedLogin(req)

    const redis: Redis = req.ctx.redis

    if (alias.player.auth.verificationEnabled) {
      await em.populate(alias.player, ['game'])

      const code = generateSixDigitCode()
      await redis.set(this.getRedisAuthKey(key, alias), code, 'EX', 300)
      await queueEmail(getGlobalQueue('email'), new PlayerAuthCode(alias, code))

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
      const socketToken = await alias.createSocketToken(redis)

      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.LOGGED_IN
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
  }

  @Route({
    method: 'POST',
    path: '/verify',
    docs: PlayerAuthAPIDocs.verify
  })
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
        errorCode: 'VERIFICATION_ALIAS_NOT_FOUND'
      })
    }

    if (!alias.player.auth) {
      req.ctx.throw(400, 'Player does not have authentication')
    }

    const redis: Redis = req.ctx.redis
    const redisCode = await redis.get(this.getRedisAuthKey(key, alias))

    if (!redisCode || code !== redisCode) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.VERIFICATION_FAILED
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Invalid code',
        errorCode: 'VERIFICATION_CODE_INVALID'
      })
    }

    await redis.del(this.getRedisAuthKey(key, alias))

    const sessionToken = await alias.player.auth.createSession(alias)
    const socketToken = await alias.createSocketToken(redis)

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.LOGGED_IN
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

  @Route({
    method: 'POST',
    path: '/logout',
    docs: PlayerAuthAPIDocs.logout
  })
  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'logout')
  async logout(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOneOrFail(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    if (!alias.player.auth) {
      req.ctx.throw(400, 'Player does not have authentication')
    }

    alias.player.auth.clearSession()

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.LOGGED_OUT
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Route({
    method: 'POST',
    path: '/change_password',
    docs: PlayerAuthAPIDocs.changePassword
  })
  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword', 'newPassword']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'changePassword')
  async changePassword(req: Request): Promise<Response> {
    const { currentPassword, newPassword } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOneOrFail(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    if (!alias.player.auth) {
      req.ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS'
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS'
      })
    }

    const isSamePassword = await bcrypt.compare(newPassword, alias.player.auth.password)
    if (isSamePassword) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_PASSWORD_FAILED,
        extra: {
          errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD'
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'Please choose a different password',
        errorCode: 'NEW_PASSWORD_MATCHES_CURRENT_PASSWORD'
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

  @Route({
    method: 'POST',
    path: '/change_email',
    docs: PlayerAuthAPIDocs.changeEmail
  })
  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword', 'newEmail']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'changeEmail')
  async changeEmail(req: Request): Promise<Response> {
    const { currentPassword, newEmail } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOneOrFail(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    if (!alias.player.auth) {
      req.ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS'
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS'
      })
    }

    const isSameEmail = newEmail === alias.player.auth.email
    if (isSameEmail) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: 'NEW_EMAIL_MATCHES_CURRENT_EMAIL'
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'Please choose a different email address',
        errorCode: 'NEW_EMAIL_MATCHES_CURRENT_EMAIL'
      })
    }

    const oldEmail = alias.player.auth.email
    const sanitisedEmail = (newEmail as string).trim().toLowerCase()
    if (emailRegex.test(sanitisedEmail)) {
      alias.player.auth.email = sanitisedEmail
    } else {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.CHANGE_EMAIL_FAILED,
        extra: {
          errorCode: 'INVALID_EMAIL'
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'Invalid email address',
        errorCode: 'INVALID_EMAIL'
      })
    }

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

  @Route({
    method: 'POST',
    path: '/forgot_password',
    docs: PlayerAuthAPIDocs.forgotPassword
  })
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
      const redis: Redis = req.ctx.redis
      const alias = playerAuth.player.aliases.find((alias) => alias.service === PlayerAliasService.TALO)

      if (alias) {
        const key = await this.getAPIKey(req.ctx)

        const code = generateSixDigitCode()
        await redis.set(this.getRedisPasswordResetKey(key, code), alias.id, 'EX', 900)
        await queueEmail(getGlobalQueue('email'), new PlayerAuthResetPassword(alias, code))

        createPlayerAuthActivity(req, playerAuth.player, {
          type: PlayerAuthActivityType.PASSWORD_RESET_REQUESTED
        })

        await em.flush()
      }
    }

    return {
      status: 204
    }
  }

  @Route({
    method: 'POST',
    path: '/reset_password',
    docs: PlayerAuthAPIDocs.resetPassword
  })
  @Validate({
    body: ['password', 'code']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'resetPassword')
  async resetPassword(req: Request): Promise<Response> {
    const { password, code } = req.body
    const em: EntityManager = req.ctx.em

    const key = await this.getAPIKey(req.ctx)

    const redis: Redis = req.ctx.redis
    const aliasId = await redis.get(this.getRedisPasswordResetKey(key, code))
    const alias = await em.getRepository(PlayerAlias).findOne({
      id: Number(aliasId),
      player: {
        game: key.game
      }
    }, {
      populate: ['player.auth']
    })

    if (!aliasId || !alias || !alias.player.auth) {
      req.ctx.throw(401, {
        message: 'This code is either invalid or has expired',
        errorCode: 'PASSWORD_RESET_CODE_INVALID'
      })
    }

    await redis.del(this.getRedisPasswordResetKey(key, code))

    alias.player.auth.password = await bcrypt.hash(password, 10)
    alias.player.auth.clearSession()

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.PASSWORD_RESET_COMPLETED
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Route({
    method: 'PATCH',
    path: '/toggle_verification',
    docs: PlayerAuthAPIDocs.toggleVerification
  })
  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword', 'verificationEnabled']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'toggleVerification')
  async toggleVerification(req: Request): Promise<Response> {
    const { currentPassword, verificationEnabled, email } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOneOrFail(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    if (!alias.player.auth) {
      req.ctx.throw(400, 'Player does not have authentication')
    }

    if (verificationEnabled && !alias.player.auth.email && !email) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
        extra: {
          errorCode: 'VERIFICATION_EMAIL_REQUIRED',
          verificationEnabled: Boolean(verificationEnabled)
        }
      })
      await em.flush()

      req.ctx.throw(400, {
        message: 'An email address is required to enable verification',
        errorCode: 'VERIFICATION_EMAIL_REQUIRED'
      })
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS',
          verificationEnabled: Boolean(verificationEnabled)
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS'
      })
    }

    alias.player.auth.verificationEnabled = Boolean(verificationEnabled)
    if (email?.trim()) {
      const sanitisedEmail = (email as string).trim().toLowerCase()
      if (emailRegex.test(sanitisedEmail)) {
        alias.player.auth.email = sanitisedEmail
      } else {
        createPlayerAuthActivity(req, alias.player, {
          type: PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED,
          extra: {
            errorCode: 'INVALID_EMAIL',
            verificationEnabled: Boolean(verificationEnabled)
          }
        })
        await em.flush()

        req.ctx.throw(400, {
          message: 'Invalid email address',
          errorCode: 'INVALID_EMAIL'
        })
      }
    }

    createPlayerAuthActivity(req, alias.player, {
      type: PlayerAuthActivityType.VERIFICATION_TOGGLED,
      extra: {
        verificationEnabled: alias.player.auth.verificationEnabled
      }
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Route({
    method: 'DELETE',
    docs: PlayerAuthAPIDocs.delete
  })
  @Validate({
    headers: ['x-talo-player', 'x-talo-alias', 'x-talo-session'],
    body: ['currentPassword']
  })
  @HasPermission(PlayerAuthAPIPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const { currentPassword } = req.body
    const em: EntityManager = req.ctx.em

    const alias = await em.getRepository(PlayerAlias).findOneOrFail(req.ctx.state.currentAliasId, {
      populate: ['player.auth']
    })

    if (!alias.player.auth) {
      req.ctx.throw(400, 'Player does not have authentication')
    }

    const passwordMatches = await bcrypt.compare(currentPassword, alias.player.auth.password)
    if (!passwordMatches) {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.DELETE_AUTH_FAILED,
        extra: {
          errorCode: 'INVALID_CREDENTIALS'
        }
      })
      await em.flush()

      req.ctx.throw(403, {
        message: 'Current password is incorrect',
        errorCode: 'INVALID_CREDENTIALS'
      })
    }

    await em.repo(PlayerAuthActivity).nativeDelete({
      player: alias.player
    })

    await em.transactional(async (trx) => {
      createPlayerAuthActivity(req, alias.player, {
        type: PlayerAuthActivityType.DELETED_AUTH,
        extra: {
          identifier: alias.identifier
        }
      })

      assert(alias.player.auth)
      trx.remove(trx.repo(PlayerAuth).getReference(alias.player.auth.id))
      trx.remove(trx.repo(PlayerAlias).getReference(alias.id))

      await deleteClickHousePlayerData({
        playerIds: [alias.player.id],
        aliasIds: [alias.id]
      })
    })

    return {
      status: 204
    }
  }
}
