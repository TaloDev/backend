import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import InviteFactory from '../../fixtures/InviteFactory.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'

describe('Invite service - index', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [token, user] = await createUserAndToken({ type })

    const invites = await new InviteFactory().construct(user.organisation).many(3)
    await (<EntityManager>global.em).persistAndFlush(invites)

    const res = await request(global.app)
      .get('/invites')
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.invites).toHaveLength(invites.length)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view invites' })
    }
  })
})
