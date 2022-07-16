import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import Game from '../../../src/entities/game'
import GameStatFactory from '../../fixtures/GameStatFactory'
import GameFactory from '../../fixtures/GameFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Game stat service - put', () => {
  let app: Koa
  let user: User
  let token: string
  let game: Game

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    game = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, game])

    token = await genAccessToken(user)
  })

  beforeEach(async () => {
    const activities = await (<EntityManager>app.context.em).getRepository(GameActivity).findAll()
    await (<EntityManager>app.context.em).removeAndFlush(activities)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update the name', async () => {
    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ internalName: stat.internalName, name: 'New name', global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates  })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.name).toBe('New name')

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'name: New name'
    })
  })

  it('should update the global status', async () => {
    const stat = await new GameStatFactory([game]).with(() => ({ global: false })).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ global: true, internalName: stat.internalName, name: stat.name, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.global).toBe(true)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'global: true'
    })
  })

  it('should update the max change', async () => {
    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ maxChange: 90, internalName: stat.internalName, name: stat.name, global: stat.global, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.maxChange).toBe(90)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'maxChange: 90'
    })
  })

  it('should update the min value', async () => {
    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ minValue: -300, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.minValue).toBe(-300)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'minValue: -300'
    })
  })

  it('should update the max value', async () => {
    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ maxValue: 80, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.maxValue).toBe(80)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'maxValue: 80'
    })
  })

  it('should update the default value', async () => {
    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ defaultValue: 3, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.defaultValue).toBe(3)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'defaultValue: 3'
    })
  })

  it('should update the min time between updates', async () => {
    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ minTimeBetweenUpdates: 10242, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.minTimeBetweenUpdates).toBe(10242)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'minTimeBetweenUpdates: 10242'
    })
  })

  it('should not update a non-existent stat', async () => {
    const stat = await new GameStatFactory([game]).one()

    const res = await request(app.callback())
      .put(`/games/${game.id}/game-stats/31223`)
      .send({ internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
