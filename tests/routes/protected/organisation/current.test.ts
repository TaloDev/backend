import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import UserFactory from '../../../fixtures/UserFactory'
import InviteFactory from '../../../fixtures/InviteFactory'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Organisation - current', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type }, organisation)

    const otherUser = await new UserFactory().state(() => ({ organisation })).one()
    const invites = await new InviteFactory().construct(organisation).state(() => ({ invitedByUser: user })).many(3)
    await em.persistAndFlush([otherUser, ...invites])

    const res = await request(app)
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
