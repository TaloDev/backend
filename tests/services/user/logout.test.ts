import request from 'supertest'
import UserSession from '../../../src/entities/user-session'
import createUserAndToken from '../../utils/createUserAndToken'

describe('User service - logout', () => {
  it('should be able to log a user out and clear sessions', async () => {
    const [token, user] = await createUserAndToken()

    const session = new UserSession(user)
    session.userAgent = 'testybrowser'
    await em.persistAndFlush(session)

    await request(app)
      .post('/users/logout')
      .set('user-agent', 'testybrowser')
      .auth(token, { type: 'bearer' })
      .expect(204)

    const sessions = await em.getRepository(UserSession).find({ user })
    expect(sessions).toHaveLength(0)
  })
})
