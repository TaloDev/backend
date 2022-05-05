import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import { DataExportAvailableEntities } from '../../../src/entities/data-export'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'
import clearEntities from '../../utils/clearEntities'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

const baseUrl = '/data-exports'

describe('Data export service - post', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['GameActivity'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 200))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.GAME_STATS, DataExportAvailableEntities.GAME_ACTIVITIES] })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.DATA_EXPORT_REQUESTED
    })

    if (statusCode === 200) {
      expect(activity.extra.dataExportId).toBe(res.body.dataExport.id)
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should not create a data export for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true })

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id, entities: [DataExportAvailableEntities.GAME_STATS, DataExportAvailableEntities.GAME_ACTIVITIES] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should create a data export for player aliases', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYER_ALIASES] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.PLAYER_ALIASES])
  })

  it('should create a data export for players', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYERS] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.PLAYERS])
  })

  it('should create a data export for events', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.EVENTS] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.EVENTS])
  })

  it('should create a data export for leaderboard entries', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.LEADERBOARD_ENTRIES] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.LEADERBOARD_ENTRIES])
  })

  it('should create a data export for game stats', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.GAME_STATS] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.GAME_STATS])
  })

  it('should create a data export for player game stats', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYER_GAME_STATS] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.PLAYER_GAME_STATS])
  })

  it('should create a data export for game activities', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.GAME_ACTIVITIES] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.dataExport.entities).toStrictEqual([DataExportAvailableEntities.GAME_ACTIVITIES])
  })

  it('should not create a data export for users with unconfirmed emails', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [DataExportAvailableEntities.PLAYER_ALIASES] })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to create data exports' })
  })

  it('should not create a data export for empty entities', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

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

  it('should not create a data export with non-string entities', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: game.id, entities: [1, 2] })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        entities: ['Entities must be an array of strings']
      }
    })
  })
})
