import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import UserFactory from '../../fixtures/UserFactory.js'
import InviteFactory from '../../fixtures/InviteFactory.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('Organisation service - current', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type }, organisation)

    const otherUser = await new UserFactory().with(() => ({ organisation })).one()
    const invites = await new InviteFactory().construct(organisation).with(() => ({ invitedByUser: user })).many(3)
    await (<EntityManager>global.em).persistAndFlush([otherUser, ...invites])

    const res = await request(global.app)
      .get('/organisations/current')
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.games).toHaveLength(1)
      expect(res.body.members).toHaveLength(2)
      expect(res.body.pendingInvites).toHaveLength(invites.length)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view organisation info' })
    }
  })
})
