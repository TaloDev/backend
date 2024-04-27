import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import UserFactory from '../../../fixtures/UserFactory'
import SendGrid from '@sendgrid/mail'

describe('User public service - forgot password', () => {
  const sendMock = vi.spyOn(SendGrid, 'send')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should let a user request a forgot password email for an existing user', async () => {
    const user = await new UserFactory().with(() => ({ password: 'p4ssw0rd' })).one()
    await (<EntityManager>global.em).persistAndFlush(user)

    await request(global.app)
      .post('/public/users/forgot_password')
      .send({ email: user.email })
      .expect(204)

    expect(sendMock).toHaveBeenCalled()
  })

  it('should let a user request a forgot password email for a non-existent user', async () => {
    await request(global.app)
      .post('/public/users/forgot_password')
      .send({ email: 'blah' })
      .expect(204)

    expect(sendMock).not.toHaveBeenCalled()
  })
})
