import request from 'supertest'
import UserAccessCode from '../../../../src/entities/user-access-code'
import UserFactory from '../../../fixtures/UserFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import InviteFactory from '../../../fixtures/InviteFactory'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import PricingPlanFactory from '../../../fixtures/PricingPlanFactory'
import { randEmail, randUserName } from '@ngneat/falso'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'

describe('User public  - register', () => {
  beforeAll(async () => {
    const pricingPlan = await new PricingPlanFactory().one()
    await em.persist(pricingPlan).flush()
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
    await em.persist(user).flush()

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
    await em.persist(invite).flush()

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
    await em.persist(invite).flush()

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
    await em.persist(invite).flush()

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
    vi.stubEnv('REGISTRATION_MODE', 'disabled')

    const res = await request(app)
      .post('/public/users/register')
      .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Registration is disabled' })

    vi.unstubAllEnvs()
  })

  it('should not let a user register if registration is exclusive', async () => {
    vi.stubEnv('REGISTRATION_MODE', 'exclusive')

    const res = await request(app)
      .post('/public/users/register')
      .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Registration requires an invitation' })

    vi.unstubAllEnvs()
  })

  describe('hCaptcha', () => {
    const axiosMock = new AxiosMockAdapter(axios)

    beforeEach(() => {
      vi.stubEnv('HCAPTCHA_SECRET', 'test-secret')
    })

    afterEach(() => {
      axiosMock.reset()
      vi.unstubAllEnvs()
    })

    it('should register a user when captcha verification succeeds', async () => {
      const verifyCaptchaMock = vi.fn(() => [200, { success: true }])
      axiosMock.onPost('https://hcaptcha.com/siteverify').reply(verifyCaptchaMock)

      const email = randEmail()
      const username = randUserName()

      const res = await request(app)
        .post('/public/users/register')
        .send({ email, username, password: 'password', organisationName: 'Talo', captchaToken: 'valid-token' })
        .expect(200)

      expect(verifyCaptchaMock).toHaveBeenCalledOnce()
      expect(res.body.accessToken).toBeTruthy()
      expect(res.body.user.email).toBe(email.toLowerCase())
    })

    it('should not register a user when captcha verification fails', async () => {
      const verifyCaptchaMock = vi.fn(() => [200, { success: false }])
      axiosMock.onPost('https://hcaptcha.com/siteverify').reply(verifyCaptchaMock)

      const res = await request(app)
        .post('/public/users/register')
        .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo', captchaToken: 'invalid-token' })
        .expect(400)

      expect(verifyCaptchaMock).toHaveBeenCalledOnce()
      expect(res.body).toStrictEqual({ message: 'Captcha verification failed, please try again' })
    })

    it('should not register a user when no captcha token is provided', async () => {
      const res = await request(app)
        .post('/public/users/register')
        .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo' })
        .expect(400)

      expect(res.body).toStrictEqual({
        errors: {
          captchaToken: ['Captcha is required']
        }
      })
    })

    it('should not register a user when the hcaptcha API returns an error', async () => {
      const verifyCaptchaMock = vi.fn(() => [500, {}])
      axiosMock.onPost('https://hcaptcha.com/siteverify').reply(verifyCaptchaMock)

      const res = await request(app)
        .post('/public/users/register')
        .send({ email: randEmail(), username: randUserName(), password: 'password', organisationName: 'Talo', captchaToken: 'some-token' })
        .expect(400)

      expect(verifyCaptchaMock).toHaveBeenCalledOnce()
      expect(res.body).toStrictEqual({ message: 'Captcha verification failed, please try again' })
    })
  })
})
