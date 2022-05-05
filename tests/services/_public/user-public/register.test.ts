import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import UserAccessCode from '../../../../src/entities/user-access-code'
import casual from 'casual'
import UserFactory from '../../../fixtures/UserFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import InviteFactory from '../../../fixtures/InviteFactory'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import clearEntities from '../../../utils/clearEntities'

const baseUrl = '/public/users'

describe('User public service - register', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['UserSession'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should register a user', async () => {
    const email = casual.email
    const username = casual.username

    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, username, password: 'password', organisationName: 'Talo' })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user.email).toBe(email.toLowerCase())
    expect(res.body.user.username).toBe(username)
    expect(res.body.user.password).not.toBeDefined()
    expect(res.body.user.organisation.name).toBe('Talo')
  })

  it('should not let a user register if the email already exists', async () => {
    const email = casual.email
    const user = await new UserFactory().with(() => ({ email })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, username: casual.username, password: 'password', organisationName: 'Talo' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'That email address is already in use' })
  })

  it('should create an access code for a new user', async () => {
    const email = casual.email

    await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, username: casual.username, password: 'password', organisationName: 'Talo' })
      .expect(200)

    const accessCode = await (<EntityManager>app.context.em).getRepository(UserAccessCode).findOne({
      user: {
        email
      }
    })

    expect(accessCode).toBeTruthy()
  })

  it('should let a user register with an invite', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush(invite)

    const email = invite.email
    const username = casual.username

    const res = await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, username, password: 'password', inviteToken: invite.token })
      .expect(200)

    expect(res.body.accessToken).toBeTruthy()
    expect(res.body.user.email).toBe(email.toLowerCase())
    expect(res.body.user.username).toBe(username)
    expect(res.body.user.password).not.toBeDefined()
    expect(res.body.user.organisation.id).toBe(organisation.id)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.INVITE_ACCEPTED
    })

    expect(activity.user.id).toBe(res.body.user.id)
  })

  it('should not let a user register with an invite if the email doesn\'t match', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush(invite)

    const email = casual.email
    const username = casual.username

    await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, username, password: 'password', inviteToken: invite.token })
      .expect(404)
  })

  it('should not let a user register with a missing invite', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush(invite)

    const email = casual.email
    const username = casual.username

    await request(app.callback())
      .post(`${baseUrl}/register`)
      .send({ email, username, password: 'password', inviteToken: 'abc123' })
      .expect(404)
  })
})
