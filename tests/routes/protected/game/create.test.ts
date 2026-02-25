import request from 'supertest'
import Game from '../../../../src/entities/game'
import { UserType } from '../../../../src/entities/user'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Game - create', () => {
  it.each(userPermissionProvider([UserType.ADMIN, UserType.DEV]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [token, user] = await createUserAndToken({ type })

      const res = await request(app)
        .post('/games')
        .send({ name: 'Twodoors' })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.game.name).toBe('Twodoors')

        const game = await em
          .getRepository(Game)
          .findOneOrFail(res.body.game.id, { populate: ['organisation'] })
        expect(game.organisation.id).toBe(user.organisation.id)
      } else {
        expect(res.body).toStrictEqual({ message: 'You do not have permissions to create games' })
      }
    },
  )

  it('should return a 500 when API_SECRET is not 32 characters long', async () => {
    const originalSecret = process.env.API_SECRET
    process.env.API_SECRET = 'too-short'

    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const res = await request(app)
      .post('/games')
      .send({ name: 'Twodoors' })
      .auth(token, { type: 'bearer' })
      .expect(500)

    expect(res.body).toStrictEqual({ message: 'API_SECRET must be 32 characters long' })

    process.env.API_SECRET = originalSecret
  })

  it('should return 500 when API_SECRET is not set', async () => {
    const originalSecret = process.env.API_SECRET
    delete process.env.API_SECRET

    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const res = await request(app)
      .post('/games')
      .send({ name: 'Twodoors' })
      .auth(token, { type: 'bearer' })
      .expect(500)

    expect(res.body).toStrictEqual({ message: 'API_SECRET must be 32 characters long' })

    process.env.API_SECRET = originalSecret
  })
})
