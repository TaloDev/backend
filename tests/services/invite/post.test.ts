import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import UserFactory from '../../fixtures/UserFactory'
import InviteFactory from '../../fixtures/InviteFactory'
import clearEntities from '../../utils/clearEntities'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import casual from 'casual'

const baseUrl = '/invites'

describe('Invite service - post', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['Invite'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [token, user] = await createUserAndToken(app.context.em, { type })

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: 'user@example.com', type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.invite.email).toBe('user@example.com')
      expect(res.body.invite.organisation.id).toBe(user.organisation.id)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create invites' })
    }
  })

  it('should not create an invite when an invite exists for the same email', async () => {
    const [token, user] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

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

  it.each([
    [400, 'owner', UserType.OWNER],
    [200, 'admin', UserType.ADMIN],
    [200, 'dev', UserType.DEV],
    [400, 'demo', UserType.DEMO]
  ])('should return a %i for a %s user type invite', async (statusCode, _, type) => {
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: casual.email, type })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode !== 200) {
      expect(res.body).toStrictEqual({
        errors: {
          type: [
            'You can only invite an admin or dev user'
          ]
        }
      })
    }
  })

  it('should not create an invite when an invite exists for the same email on another organisation', async () => {
    const [otherOrg] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

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
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const user = await new UserFactory().with(() => ({ email: 'user@example.com' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ email: user.email, type: 1 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'This email address is already in use' })
  })
})
