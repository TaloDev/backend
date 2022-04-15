import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User, { UserType } from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import InviteFactory from '../../fixtures/InviteFactory'
import Invite from '../../../src/entities/invite'
import OrganisationFactory from '../../fixtures/OrganisationFactory'

const baseUrl = '/invites'

describe('Invite service - post', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(Invite)
    const invites = await repo.findAll()
    await repo.removeAndFlush(invites)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create an invite', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: 'user@example.com', type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.invite.email).toBe('user@example.com')
    expect(res.body.invite.organisation.id).toBe(user.organisation.id)
  })

  it('should not create an invite when an invite exists for the same email', async () => {
    const invite = await new InviteFactory().construct(user.organisation).with(() => ({
      email: 'user@example.com'
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invite)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: invite.email, type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'An invite for this email address already exists' })
  })

  it('should not create an invite when an invite exists for the same email on another organisation', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(otherOrg).with(() => ({
      email: 'user@example.com'
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invite)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: invite.email, type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'This email address is already in use' })
  })

  it('should not create an invite when a user exists for the same email', async () => {
    const user = await new UserFactory().with(() => ({ email: 'user@example.com' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: user.email, type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'This email address is already in use' })
  })

  it('should not create invites for dev users', async () => {
    user.type = UserType.DEV
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: 'user@example.com', type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create invites for demo users', async () => {
    user.type = UserType.DEMO
    await (<EntityManager>app.context.em).flush()

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: 'user@example.com', type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
