import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import bcrypt from 'bcrypt'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/users'

describe('User service - change password', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should let users change their password', async () => {
    user.password = await bcrypt.hash('password', 10)
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ currentPassword: 'password', newPassword: 'mynewpassword' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
  })

  it('should not let users change their password if their current password is wrong', async () => {
    user.password = await bcrypt.hash('password', 10)
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ currentPassword: 'passw0rd', newPassword: 'password2' })
      .auth(token, { type: 'bearer' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Current password is incorrect' })
  })

  it('should not let users change their password to the same one', async () => {
    user.password = await bcrypt.hash('password', 10)
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ currentPassword: 'password', newPassword: 'password' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Please choose a different password' })
  })
})
