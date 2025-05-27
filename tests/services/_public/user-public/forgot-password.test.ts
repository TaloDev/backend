import request from 'supertest'
import UserFactory from '../../../fixtures/UserFactory'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'

describe('User public service - forgot password', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should let a user request a forgot password email for an existing user', async () => {
    const user = await new UserFactory().state(() => ({ password: 'p4ssw0rd' })).one()
    await em.persistAndFlush(user)

    await request(app)
      .post('/public/users/forgot_password')
      .send({ email: user.email })
      .expect(204)

    expect(sendMock).toHaveBeenCalled()
  })

  it('should let a user request a forgot password email for a non-existent user', async () => {
    await request(app)
      .post('/public/users/forgot_password')
      .send({ email: 'blah' })
      .expect(204)

    expect(sendMock).not.toHaveBeenCalled()
  })
})
