import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import GameStatFactory from '../../fixtures/GameStatFactory'
import clearEntities from '../../utils/clearEntities'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'

describe('Game stat service - post', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['GameStat', 'GameActivity'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    const res = await request(app.callback())
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10  })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_CREATED
    })

    if (statusCode === 200) {
      expect(res.body.stat.internalName).toBe('levels-completed')
      expect(res.body.stat.name).toBe('Levels completed')
      expect(res.body.stat.global).toBe(false)
      expect(res.body.stat.globalValue).toBe(0)
      expect(res.body.stat.defaultValue).toBe(0)
      expect(res.body.stat.maxChange).toBe(undefined)
      expect(res.body.stat.minValue).toBe(-10)
      expect(res.body.stat.maxValue).toBe(10)
      expect(res.body.stat.minTimeBetweenUpdates).toBe(0)

      expect(activity.extra.statInternalName).toBe(res.body.stat.internalName)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create stats' })

      expect(activity).toBeNull()
    }
  })

  it('should create a global stat', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const res = await request(app.callback())
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: true, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10  })
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

  it('should not create a stat for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em)

    await request(app.callback())
      .post(`/games/${otherGame.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a stat for a non-existent game', async () => {
    const [token] = await createUserAndToken(app.context.em)

    const res = await request(app.callback())
      .post('/games/99999/game-stats')
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a stat with a duplicate internal name', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const stat = await new GameStatFactory([game]).with(() => ({ internalName: 'levels-completed' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        internalName: ['A stat with the internalName levels-completed already exists']
      }
    })
  })

  it('should create a stat with a duplicate internal name for another game', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const stat = await new GameStatFactory([otherGame]).with(() => ({ internalName: 'levels-completed' })).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    await request(app.callback())
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10 })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
