import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameFactory from '../../fixtures/GameFactory'
import { DataExportAvailableEntities } from '../../../src/entities/data-export'

const baseUrl = '/data-exports'

describe('Data export service - post', () => {
  let app: Koa
  let user: User
  let game: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').state('email confirmed').one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a data export for player aliases', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYER_ALIASES] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport).toBeTruthy()
    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.PLAYER_ALIASES])
  })

  it('should create a data export for players', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYERS] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport).toBeTruthy()
    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.PLAYERS])
  })

  it('should create a data export for events', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.EVENTS] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport).toBeTruthy()
    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.EVENTS])
  })

  it('should create a data export for events', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.LEADERBOARD_ENTRIES] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport).toBeTruthy()
    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.LEADERBOARD_ENTRIES])
  })

  it('should not create a data export for dev users', async () => {
    const invalidUser = await new UserFactory().with(() => ({ organisation: game.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidUser)

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYERS] })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to create data exports' })
  })

  it('should not create a data export for users with unconfirmed emails', async () => {
    const invalidUser = await new UserFactory().state('admin').with(() => ({ organisation: game.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidUser)

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYER_ALIASES] })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to create data exports' })
  })

  it('should not create a data export for empty entities', async () => {
    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [] })
      .auth(token, { type: 'bearer' })
      .expect(400)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })
})
