import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import UserTwoFactorAuth from '../../../src/entities/user-two-factor-auth'
import createUserAndToken from '../../utils/createUserAndToken'

const baseUrl = '/users'

describe('User service - enable 2fa', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users enable 2fa', async () => {
    const [token, user] = await createUserAndToken(app.context.em)

    const res = await request(app.callback())
      .get(`${baseUrl}/2fa/enable`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.qr).toBeTruthy()

    await (<EntityManager>app.context.em).refresh(user)
    expect(user.twoFactorAuth).toBeTruthy()
    expect(user.twoFactorAuth.enabled).toBe(false)
  })

  it('should not let users enable 2fa if it is already enabled', async () => {
    const [token, user] = await createUserAndToken(app.context.em, {
      twoFactorAuth: new UserTwoFactorAuth('blah')
    })

    user.twoFactorAuth.enabled = true
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .get(`${baseUrl}/2fa/enable`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Two factor authentication is already enabled' })
  })
})
