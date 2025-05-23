import request from 'supertest'
import UserFactory from '../../../fixtures/UserFactory'
import bcrypt from 'bcrypt'
import { sign } from '../../../../src/lib/auth/jwt'

describe('User public service - reset password', () => {
  it('should let a user reset their password', async () => {
    const password = await bcrypt.hash('p4ssw0rd112233', 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persistAndFlush(user)

    const token = await sign({ sub: user.id }, user.password.substring(0, 10), { expiresIn: '15m' })

    await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: 'my-new-passw0rd1!' })
      .expect(204)

    await em.refresh(user)
    expect(await bcrypt.compare('my-new-passw0rd1!', user.password)).toBe(true)
  })

  it('should not let a user reset their password if they supply the same one', async () => {
    const password = await bcrypt.hash('p4ssw0rd112233', 10)
    const user = await new UserFactory().state(() => ({ password })).one()
    await em.persistAndFlush(user)

    const token = await sign({ sub: user.id }, user.password.substring(0, 10), { expiresIn: '15m' })

    const res = await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: 'p4ssw0rd112233' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Please choose a different password' })
  })

  it('should not let a user reset their password if the token is invalid', async () => {
    const token = await sign({ sub: 1 }, 'wrong secret', { expiresIn: '15m' })

    const res = await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: '3432ndjwedn1' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired', expired: true })
  })

  it('should not let a non-existent', async () => {
    const token = await sign({ sub: 21313123 }, 'whatever', { expiresIn: '15m' })

    const res = await request(app)
      .post('/public/users/reset_password')
      .send({ token, password: '3432ndjwedn1' })
      .expect(401)

    expect(res.body).toStrictEqual({ message: 'Request expired', expired: true })
  })
})
