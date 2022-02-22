import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserAccessCode from '../../../src/entities/user-access-code'
import UserFactory from '../../fixtures/UserFactory'

const baseUrl = '/users'

describe('User service - confirm email', () => {
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

  it('should let a user confirm their email', async () => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    const accessCode = new UserAccessCode(user, date)
    await (<EntityManager>app.context.em).persistAndFlush(accessCode)

    const res = await request(app.callback())
      .post(`${baseUrl}/confirm_email`)
      .send({ code: accessCode.code })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user.emailConfirmed).toBe(true)

    await (<EntityManager>app.context.em).clear()
    const updatedAccessCode = await (<EntityManager>app.context.em).getRepository(UserAccessCode).findOne({ code: accessCode.code })

    expect(updatedAccessCode).toBeNull()
  })

  it('should not let a user confirm their email with an expired code', async () => {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    const accessCode = new UserAccessCode(user, date)
    await (<EntityManager>app.context.em).persistAndFlush(accessCode)

    const res = await request(app.callback())
      .post(`${baseUrl}/confirm_email`)
      .send({ code: accessCode.code })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid or expired code' })
  })

  it('should not let a user confirm their email with an invalid code', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/confirm_email`)
      .send({ code: '312321' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid or expired code' })
  })
})
