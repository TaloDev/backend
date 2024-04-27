import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import Game from '../../../src/entities/game'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Game service - post', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [token, user] = await createUserAndToken({ type })

    const res = await request(global.app)
      .post('/games')
      .send({ name: 'Twodoors' })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.game.name).toBe('Twodoors')

      const game = await (<EntityManager>global.em).getRepository(Game).findOne(res.body.game.id, { populate: ['organisation'] })
      expect(game.organisation.id).toBe(user.organisation.id)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create games' })
    }
  })
})
