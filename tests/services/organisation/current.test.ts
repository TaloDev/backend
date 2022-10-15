import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import UserFactory from '../../fixtures/UserFactory'
import InviteFactory from '../../fixtures/InviteFactory'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

const baseUrl = '/organisations/current'

describe('Organisation service - current', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation] = await createOrganisationAndGame(app.context.em)
    const [token, user] = await createUserAndToken(app.context.em, { type }, organisation)

    const otherUser = await new UserFactory().with(() => ({ organisation })).one()
    const invites = await new InviteFactory().construct(organisation).with(() => ({ invitedByUser: user })).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([otherUser, ...invites])

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.games).toHaveLength(1)
      expect(res.body.members).toHaveLength(2)
      expect(res.body.pendingInvites).toHaveLength(invites.length)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view organisation info' })
    }
  })
})
