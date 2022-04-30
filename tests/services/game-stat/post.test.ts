import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import GameFactory from '../../fixtures/GameFactory'
import Game from '../../../src/entities/game'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import GameStat from '../../../src/entities/game-stat'
import GameStatFactory from '../../fixtures/GameStatFactory'

const baseUrl = '/game-stats'

describe('Game stat service - post', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    const repo = (<EntityManager>app.context.em).getRepository(GameStat)
    const stats = await repo.findAll()
    await repo.removeAndFlush(stats)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a stat', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10  })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('levels-completed')
    expect(res.body.stat.name).toBe('Levels completed')
    expect(res.body.stat.global).toBe(false)
    expect(res.body.stat.globalValue).toBe(0)
    expect(res.body.stat.defaultValue).toBe(0)
    expect(res.body.stat.maxChange).toBe(undefined)
    expect(res.body.stat.minValue).toBe(-10)
    expect(res.body.stat.maxValue).toBe(10)
    expect(res.body.stat.minTimeBetweenUpdates).toBe(0)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_CREATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should create a global stat', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: true, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10  })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('buildings-built')
    expect(res.body.stat.name).toBe('Buildings built')
    expect(res.body.stat.global).toBe(true)
    expect(res.body.stat.globalValue).toBe(5)
    expect(res.body.stat.defaultValue).toBe(5)
    expect(res.body.stat.maxChange).toBe(undefined)
    expect(res.body.stat.minValue).toBe(-10)
    expect(res.body.stat.maxValue).toBe(10)
    expect(res.body.stat.minTimeBetweenUpdates).toBe(0)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_CREATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should not create a stat for demo users', async () => {
    const invalidUser = await new UserFactory().state('demo').with(() => ({ organisation: validGame.organisation })).one()
    await (<EntityManager>app.context.em).persistAndFlush(invalidUser)

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0 })
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Demo accounts cannot create stats' })
  })

  it('should not create a stat for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    await (<EntityManager>app.context.em).persistAndFlush([otherOrg, otherGame])

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: otherGame.id, internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a stat for a non-existent game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: 99, internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a stat with a duplicate internal name', async () => {
    const stat = await new GameStatFactory([validGame]).with(() => ({ internalName: 'levels-completed' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        internalName: ['A stat with the internalName levels-completed already exists']
      }
    })
  })

  it('should create a stat with a duplicate internal name for another game', async () => {
    const otherGame = await new GameFactory(user.organisation).one()
    const stat = await new GameStatFactory([otherGame]).with(() => ({ internalName: 'levels-completed' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    await request(app.callback())
      .post(`${baseUrl}`)
      .send({ gameId: validGame.id, internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
