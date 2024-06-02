import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import UserFactory from '../../fixtures/UserFactory.js'
import InviteFactory from '../../fixtures/InviteFactory.js'
import clearEntities from '../../utils/clearEntities.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import casual from 'casual'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity.js'
import PricingPlanActionFactory from '../../fixtures/PricingPlanActionFactory.js'
import { PricingPlanActionType } from '../../../src/entities/pricing-plan-action.js'
import OrganisationPricingPlanFactory from '../../fixtures/OrganisationPricingPlanFactory.js'
import OrganisationPricingPlanActionFactory from '../../fixtures/OrganisationPricingPlanActionFactory.js'

describe('Invite service - post', () => {
  beforeEach(async () => {
    await clearEntities(['GameActivity'])
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [token, user] = await createUserAndToken({ type, emailConfirmed: true })

    const email = casual.email

    const res = await request(global.app)
      .post('/invites')
      .send({ email, type: UserType.ADMIN })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.INVITE_CREATED
    })

    if (statusCode === 200) {
      expect(res.body.invite.email).toBe(email)
      expect(res.body.invite.organisation.id).toBe(user.organisation.id)

      expect(activity.extra.inviteEmail).toBe(email)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create invites' })

      expect(activity).toBe(null)
    }
  })

  it('should not create an invite when an invite exists for the same email', async () => {
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true })

    const invite = await new InviteFactory().construct(user.organisation).with(() => ({
      email: casual.email
    })).one()
    await (<EntityManager>global.em).persistAndFlush(invite)

    const res = await request(global.app)
      .post('/invites')
      .send({ email: invite.email, type: UserType.ADMIN })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'An invite for this email address already exists' })
  })

  it.each([
    [400, 'owner', UserType.OWNER],
    [200, 'admin', UserType.ADMIN],
    [200, 'dev', UserType.DEV],
    [400, 'demo', UserType.DEMO]
  ])('should return a %i for a %s user type invite', async (statusCode, _, type) => {
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true })

    const res = await request(global.app)
      .post('/invites')
      .send({ email: casual.email, type })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode !== 200) {
      expect(res.body).toStrictEqual({
        errors: {
          type: [
            'You can only invite an admin or developer user'
          ]
        }
      })
    }
  })

  it('should not create an invite when an invite exists for the same email on another organisation', async () => {
    const [otherOrg] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true })

    const invite = await new InviteFactory().construct(otherOrg).with(() => ({
      email: casual.email
    })).one()
    await (<EntityManager>global.em).persistAndFlush(invite)

    const res = await request(global.app)
      .post('/invites')
      .send({ email: invite.email, type: UserType.ADMIN })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'This email address is already in use' })
  })

  it('should not create an invite when a user exists for the same email', async () => {
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true })

    const user = await new UserFactory().with(() => ({ email: casual.email })).one()
    await (<EntityManager>global.em).persistAndFlush(user)

    const res = await request(global.app)
      .post('/invites')
      .send({ email: user.email, type: UserType.ADMIN })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'This email address is already in use' })
  })

  it('should not create an invite if a pricing plan limit has been hit', async () => {
    const planAction = await new PricingPlanActionFactory().with(() => ({ type: PricingPlanActionType.USER_INVITE })).one()
    const orgPlan = await new OrganisationPricingPlanFactory().with(() => ({ pricingPlan: planAction.pricingPlan })).one()
    const orgPlanActions = await new OrganisationPricingPlanActionFactory(orgPlan).with(() => ({ type: planAction.type })).many(planAction.limit)

    const [organisation] = await createOrganisationAndGame({ pricingPlan: orgPlan })
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    await (<EntityManager>global.em).persistAndFlush([planAction, ...orgPlanActions])

    await request(global.app)
      .post('/invites')
      .send({ email: casual.email, type: UserType.DEV })
      .auth(token, { type: 'bearer' })
      .expect(402)
  })

  it('should reject creating an invite if the organisation plan is not in the active state', async () => {
    const planAction = await new PricingPlanActionFactory().with(() => ({ type: PricingPlanActionType.USER_INVITE })).one()
    const orgPlan = await new OrganisationPricingPlanFactory().with(() => ({ pricingPlan: planAction.pricingPlan, status: 'incomplete' })).one()
    const orgPlanActions = await new OrganisationPricingPlanActionFactory(orgPlan).with(() => ({ type: planAction.type })).many(planAction.limit)

    const [organisation] = await createOrganisationAndGame({ pricingPlan: orgPlan })
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    await (<EntityManager>global.em).persistAndFlush([planAction, ...orgPlanActions])

    const res = await request(global.app)
      .post('/invites')
      .send({ email: casual.email, type: UserType.DEV })
      .auth(token, { type: 'bearer' })
      .expect(402)

    expect(res.body).toStrictEqual({ message: 'Your subscription is in an incomplete state. Please update your billing details.' })
  })

  it('should not create an invite if the user\'s email is not confirmed', async () => {
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const res = await request(global.app)
      .post('/invites')
      .send({ email: 'dev@game.studio', type: UserType.DEV })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to create invites' })
  })
})
