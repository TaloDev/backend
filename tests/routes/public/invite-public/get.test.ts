import request from 'supertest'
import InviteFactory from '../../../fixtures/InviteFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'

describe('Invite public - get', () => {
  it('should return an existing invite', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await em.persistAndFlush(invite)

    const res = await request(app)
      .get(`/public/invites/${invite.token}`)
      .expect(200)

    expect(res.body.invite.email).toBe(invite.email)
  })

  it('should not return a missing invite', async () => {
    await request(app)
      .get('/public/invites/abc123')
      .expect(404)
  })
})
