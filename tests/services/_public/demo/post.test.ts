import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import Organisation from '../../../../src/entities/organisation'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import User, { UserType } from '../../../../src/entities/user'

const baseUrl = '/public/demo'

describe('Demo service - post', () => {
  let app: Koa
  let demoOrg: Organisation

  beforeAll(async () => {
    app = await init()

    demoOrg = await new OrganisationFactory().state('demo').one()
    await (<EntityManager>app.context.em).getRepository(Organisation).persistAndFlush(demoOrg)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a demo user', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation.id).toBe(demoOrg.id)
    expect(res.body.user.type).toBe(UserType.DEMO)

    expect(res.body.accessToken).toBeTruthy()

    const user = await (<EntityManager>app.context.em).getRepository(User).findOne(res.body.user.id)

    expect(user).toBeNull()
  })
})
