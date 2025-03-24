import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import InviteFactory from '../../fixtures/InviteFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'

describe('Invite service - index', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [token, user] = await createUserAndToken({ type })

    const invites = await new InviteFactory().construct(user.organisation).many(3)
    await em.persistAndFlush(invites)

    const res = await request(app)
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
