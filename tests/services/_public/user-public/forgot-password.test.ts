import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import UserFactory from '../../../fixtures/UserFactory'

describe('User public service - forgot password', () => {
  it('should let a user request a forgot password email for an existing user', async () => {
    const user = await new UserFactory().with(() => ({ password: 'p4ssw0rd' })).one()
    await (<EntityManager>global.em).persistAndFlush(user)

    const res = await request(global.app)
      .post('/public/users/forgot_password')
      .send({ email: user.email })
      .expect(200)

    expect(res.body.user.id).toBe(user.id)
  })

  it('should let a user request a forgot password email for a non-existent user', async () => {
    const res = await request(global.app)
      .post('/public/users/forgot_password')
      .send({ email: 'blah' })
      .expect(204)

    expect(res.body.user).not.toBeTruthy()
  })
})
