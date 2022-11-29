import { Collection, EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserRecoveryCode from '../../../../src/entities/user-recovery-code'
import redisConfig from '../../../../src/config/redis.config'
import Redis from 'ioredis'
import createUserAndToken from '../../../utils/createUserAndToken'
import UserTwoFactorAuth from '../../../../src/entities/user-two-factor-auth'
import bcrypt from 'bcrypt'
import User from '../../../../src/entities/user'
import generateRecoveryCodes from '../../../../src/lib/auth/generateRecoveryCodes'

const baseUrl = '/public/users'

async function setTwoFactorAuthSession(user: User) {
  const redis = new Redis(redisConfig)
  await redis.set(`2fa:${user.id}`, 'true')
  await redis.quit()
}

async function createUserWithTwoFactorAuth(em: EntityManager): Promise<[string, User]> {
  const [token, user] = await createUserAndToken(em, {
    twoFactorAuth: new UserTwoFactorAuth('blah'),
    password: await bcrypt.hash('password', 10)
  })

  user.twoFactorAuth.enabled = true
  user.recoveryCodes = new Collection<UserRecoveryCode>(user, generateRecoveryCodes(user))
  await em.flush()

  return [token, user]
}

describe('User public service - use recovery code', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users login with a recovery code', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(app.context.em)
    await setTwoFactorAuthSession(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: user.recoveryCodes[0].getPlainCode(), userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toBeUndefined()

    await (<EntityManager>app.context.em).refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(7)
  })

  it('should generate a new set of recovery codes after using the last one', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(app.context.em)
    await setTwoFactorAuthSession(user)

    user.recoveryCodes.set([new UserRecoveryCode(user)])
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: user.recoveryCodes[0].getPlainCode(), userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.newRecoveryCodes).toHaveLength(8)

    await (<EntityManager>app.context.em).refresh(user, { populate: ['recoveryCodes'] })
    expect(user.recoveryCodes).toHaveLength(8)
  })

  it('should not let users login without a 2fa session', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(app.context.em)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Session expired', sessionExpired: true })
  })

  it('should not let users login with an invalid recovery code', async () => {
    const [token, user] = await createUserWithTwoFactorAuth(app.context.em)
    await setTwoFactorAuthSession(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/2fa/recover`)
      .send({ code: 'abc123', userId: user.id })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})
