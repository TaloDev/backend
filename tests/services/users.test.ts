import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'
import UserAccessCode from '../../src/entities/user-access-code'
import bcrypt from 'bcrypt'

const baseUrl = '/users'

describe('Users service', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = new User()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should be able to log a user out', async () => {
    await request(app.callback())
      .post(`${baseUrl}/logout`)
      .auth(token, { type: 'bearer' })
      .expect(204)
  })

  it('should let users change their password', async () => {
    user.password = await bcrypt.hash('password', 10)
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .post(`${baseUrl}/change_password`)
      .send({ currentPassword: 'password', newPassword: 'mynewpassword' })
      .auth(token, { type: 'bearer' })
      .expect(200)
    
    expect(res.body.accessToken).toBeDefined()
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

  it('should return the user\'s data', async () => {
    user.games.add(new Game('Vigilante 2084'))
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .get(`${baseUrl}/me`)
      .auth(token, { type: 'bearer' })
      .expect(200)
    
    expect(res.body.user).toBeDefined()
    expect(res.body.user.games).toHaveLength(1)
    expect(res.body.user.games[0].name).toBe('Vigilante 2084')
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

      expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })

  it('should not let a user confirm their email with an invalid code', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}/confirm_email`)
      .send({ code: '312321' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Invalid code' })
  })
})