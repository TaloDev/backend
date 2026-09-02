import request from 'supertest'
import OrganisationMember from '../../../../src/entities/organisation-member.js'
import { UserType } from '../../../../src/entities/user.js'
import OrganisationFactory from '../../../fixtures/OrganisationFactory.js'
import OrganisationPricingPlanFactory from '../../../fixtures/OrganisationPricingPlanFactory.js'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Organisation - list memberships', () => {
  it('should return all of the users organisations', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken(
      { type: UserType.OWNER, emailConfirmed: true },
      organisation,
    )

    const pricingPlan = await new PricingPlanFactory().one()
    const secondOrganisation = await new OrganisationFactory().one()
    secondOrganisation.pricingPlan = await new OrganisationPricingPlanFactory()
      .state(() => ({ organisation: secondOrganisation, pricingPlan }))
      .one()
    await em.persist(secondOrganisation).flush()

    const membership = new OrganisationMember(user, secondOrganisation, UserType.DEV)
    await em.persist(membership).flush()

    const res = await request(app)
      .get('/organisations/memberships')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.memberships).toHaveLength(2)
    expect(
      res.body.memberships.map(
        (member: { organisation: { id: number } }) => member.organisation.id,
      ),
    ).toContain(organisation.id)
    expect(
      res.body.memberships.map(
        (member: { organisation: { id: number } }) => member.organisation.id,
      ),
    ).toContain(secondOrganisation.id)
  })
})
