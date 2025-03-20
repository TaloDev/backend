import request from 'supertest'
import InviteFactory from '../../../fixtures/InviteFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'

describe('Invite public service - get', () => {
  it('should return an existing invite', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await global.em.persistAndFlush(invite)

    const res = await request(global.app)
      .get(`/public/invites/${invite.token}`)
      .expect(200)

    expect(res.body.invite.email).toBe(invite.email)
  })

  it('should not return a missing invite', async () => {
    await request(global.app)
      .get('/public/invites/abc123')
      .expect(404)
  })
})
