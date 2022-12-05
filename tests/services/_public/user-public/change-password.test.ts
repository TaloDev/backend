import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import UserFactory from '../../../fixtures/UserFactory'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { promisify } from 'util'

describe('User public service - change password', () => {
  it('should let a user change their password', async () => {
    const password = await bcrypt.hash('p4ssw0rd112233', 10)
    const user = await new UserFactory().with(() => ({ password })).one()
    await (<EntityManager>global.em).persistAndFlush(user)

    let res = await request(global.app)
      .post('/public/users/forgot_password')
      .send({ email: user.email })
      .expect(200)

    const token = res.body.accessToken

    res = await request(global.app)
      .post('/public/users/change_password')
      .send({ token, password: 'my-new-passw0rd1!' })
      .expect(200)

    expect(res.body.user.id).toBe(user.id)
    expect(res.body.accessToken).toBeTruthy()
  })

  it('should not let a user change their password if they supply the same one', async () => {
    const password = await bcrypt.hash('p4ssw0rd112233', 10)
    const user = await new UserFactory().with(() => ({ password })).one()
    await (<EntityManager>global.em).persistAndFlush(user)

    let res = await request(global.app)
      .post('/public/users/forgot_password')
      .send({ email: user.email })
      .expect(200)

    const token = res.body.accessToken

    res = await request(global.app)
      .post('/public/users/change_password')
      .send({ token, password: 'p4ssw0rd112233' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Please choose a different password' })
  })

  it('should not let a user change their password if the token is invalid', async () => {
    const sign = promisify(jwt.sign)
    const token = await sign({ sub: 1 }, 'wrong secret', { expiresIn: '15m' })

    const res = await request(global.app)
      .post('/public/users/change_password')
      .send({ token, password: '3432ndjwedn1' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired' })
  })

  it('should not let a non-existent', async () => {
    const sign = promisify(jwt.sign)
    const token = await sign({ sub: 21313123 }, 'whatever', { expiresIn: '15m' })

    const res = await request(global.app)
      .post('/public/users/change_password')
      .send({ token, password: '3432ndjwedn1' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired' })
  })
})
