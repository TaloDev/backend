import request from 'supertest'
import { UserType } from '../../../../src/entities/user.js'
import InviteFactory from '../../../fixtures/InviteFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Invite - resend', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [token, user] = await createUserAndToken({ type, emailConfirmed: true })

      const invite = await new InviteFactory().construct(user.organisation).one()
      await em.persist(invite).flush()

      const res = await request(app)
        .post(`/invites/${invite.id}/resend`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.invite.id).toBe(invite.id)
      } else {
        expect(res.body).toStrictEqual({ message: 'You do not have permissions to resend invites' })
      }
    },
  )

  it('should not resend an invite from another organisation', async () => {
    const [otherOrg] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true })

    const invite = await new InviteFactory().construct(otherOrg).one()
    await em.persist(invite).flush()

    const res = await request(app)
      .post(`/invites/${invite.id}/resend`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Invite not found' })
  })

  it('should not resend an invite more than once every 60 seconds', async () => {
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true })

    const invite = await new InviteFactory().construct(user.organisation).one()
    await em.persist(invite).flush()

    await request(app)
      .post(`/invites/${invite.id}/resend`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const res = await request(app)
      .post(`/invites/${invite.id}/resend`)
      .auth(token, { type: 'bearer' })
      .expect(429)

    expect(res.body).toStrictEqual({
      message: 'Invites can only be resent once every 60 seconds',
    })
  })
})
