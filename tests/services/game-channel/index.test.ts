import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Game channel service - index', () => {
  it('should return a list of game channels', async () => {
    const [token] = await createUserAndToken()

    await request(global.app)
      .get('/game-channels')
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
