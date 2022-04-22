import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import InviteFactory from '../../../fixtures/InviteFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'

const baseUrl = '/public/invites'

describe('Invite public service - get', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return an existing invite', async () => {
    const organisation = await new OrganisationFactory().one()
    const invite = await new InviteFactory().construct(organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush(invite)

    const res = await request(app.callback())
      .get(`${baseUrl}/${invite.token}`)
      .expect(200)

    expect(res.body.invite.email).toBe(invite.email)
  })

  it('should not return a missing invite', async () => {
    await request(app.callback())
      .get(`${baseUrl}/abc123`)
      .expect(404)
  })
})
