import request from 'supertest'
import OrganisationMember from '../../../../src/entities/organisation-member.js'
import { UserType } from '../../../../src/entities/user.js'
import OrganisationFactory from '../../../fixtures/OrganisationFactory.js'
import OrganisationPricingPlanFactory from '../../../fixtures/OrganisationPricingPlanFactory.js'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Organisation - switch', () => {
  it('should switch the current organisation and sync the user type', async () => {
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
      .post('/organisations/switch')
      .send({ organisationId: secondOrganisation.id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.user.organisation.id).toBe(secondOrganisation.id)
    expect(res.body.user.type).toBe(UserType.DEV)
  })

  it('should return 404 for an organisation the user is not a member of', async () => {
    const [token] = await createUserAndToken({ emailConfirmed: true })
    const [otherOrganisation] = await createOrganisationAndGame()

    const res = await request(app)
      .post('/organisations/switch')
      .send({ organisationId: otherOrganisation.id })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Membership not found' })
  })

  it('should return 400 for an invalid organisation id', async () => {
    const [token] = await createUserAndToken({ emailConfirmed: true })

    await request(app)
      .post('/organisations/switch')
      .send({ organisationId: 'abc' })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })
})
