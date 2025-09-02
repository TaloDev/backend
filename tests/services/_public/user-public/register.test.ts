import request from 'supertest'
import UserAccessCode from '../../../../src/entities/user-access-code'
import UserFactory from '../../../fixtures/UserFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import InviteFactory from '../../../fixtures/InviteFactory'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import { randEmail, randUserName } from '@ngneat/falso'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('User public service - register', () => {
  beforeAll(async () => {
    const pricingPlan = await new PricingPlanFactory().one()
    await em.persistAndFlush(pricingPlan)
  })

  it('should register a user', async () => {
    const email = randEmail()
    const username = randUserName()

    const res = await request(app)
      .post('/public/users/register')
      .send({ email, username, password: 'password', organisationName: 'Talo' })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user.email).toBe(email.toLowerCase())
    expect(res.body.user.username).toBe(username)
    expect(res.body.user.password).not.toBeDefined()
    expect(res.body.user.organisation.name).toBe('Talo')
    expect(res.body.user.organisation.games).toEqual([])
  })

  it('should not let a user register if the email already exists', async () => {
    const email = randEmail()
    const user = await new UserFactory().state(() => ({ email })).one()
    await em.persistAndFlush(user)

    const res = await request(app)
      .post('/public/users/register')
      .send({ email, username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Email address is already in use' })
  })

  it('should create an access code for a new user', async () => {
    const email = randEmail()

    await request(app)
      .post('/public/users/register')
      .send({ email, username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(200)

    const accessCode = await em.getRepository(UserAccessCode).findOne({
      user: {
        email
      }
    })

    expect(accessCode).toBeTruthy()
  })

  it('should let a user register with an invite', async () => {
    const [organisation] = await createOrganisationAndGame()
    const invite = await new InviteFactory().construct(organisation).one()
    await em.persistAndFlush(invite)

    const email = invite.email
    const username = randUserName()

    const res = await request(app)
      .post('/public/users/register')
      .send({ email, username, password: 'password', inviteToken: invite.token })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user.email).toBe(email.toLowerCase())
    expect(res.body.user.username).toBe(username)
    expect(res.body.user.password).not.toBeDefined()
    expect(res.body.user.organisation.id).toBe(organisation.id)
    expect(res.body.user.organisation.games).toHaveLength(1)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.INVITE_ACCEPTED
    })

    expect(activity!.user.id).toBe(res.body.user.id)
  })

  it('should not let a user register with an invite if the email doesn\'t match', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await em.persistAndFlush(invite)

    const email = randEmail()
    const username = randUserName()

    await request(app)
      .post('/public/users/register')
      .send({ email, username, password: 'password', inviteToken: invite.token })
      .expect(404)
  })

  it('should not let a user register with a missing invite', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await em.persistAndFlush(invite)

    const email = randEmail()
    const username = randUserName()

    await request(app)
      .post('/public/users/register')
      .send({ email, username, password: 'password', inviteToken: 'abc123' })
      .expect(404)
  })

  it('should not let a user register if their email is invalid', async () => {
    const res = await request(app)
      .post('/public/users/register')
      .send({ email: 'bleh', username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        email: ['Email address is invalid']
      }
    })
  })

  it('should not let a user register if registration is disabled', async () => {
    process.env.REGISTRATION_MODE = 'disabled'

    const res = await request(app)
      .post('/public/users/register')
      .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Registration is disabled' })

    delete process.env.REGISTRATION_MODE
  })

  it('should not let a user register if registration is exclusive', async () => {
    process.env.REGISTRATION_MODE = 'exclusive'

    const res = await request(app)
      .post('/public/users/register')
      .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Registration requires an invitation' })

    delete process.env.REGISTRATION_MODE
  })
})
