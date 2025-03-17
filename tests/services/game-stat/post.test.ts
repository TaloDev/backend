import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import GameStatFactory from '../../fixtures/GameStatFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'

describe('Game stat service - post', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: 1 })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_CREATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.stat.internalName).toBe('levels-completed')
      expect(res.body.stat.name).toBe('Levels completed')
      expect(res.body.stat.global).toBe(false)
      expect(res.body.stat.globalValue).toBe(0)
      expect(res.body.stat.defaultValue).toBe(0)
      expect(res.body.stat.maxChange).toBe(1)
      expect(res.body.stat.minValue).toBe(-10)
      expect(res.body.stat.maxValue).toBe(10)
      expect(res.body.stat.minTimeBetweenUpdates).toBe(0)

      expect(activity!.extra.statInternalName).toBe(res.body.stat.internalName)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create stats' })

      expect(activity).toBeNull()
    }
  })

  it('should create a global stat', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: true, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('buildings-built')
    expect(res.body.stat.name).toBe('Buildings built')
    expect(res.body.stat.global).toBe(true)
    expect(res.body.stat.globalValue).toBe(5)
    expect(res.body.stat.defaultValue).toBe(5)
    expect(res.body.stat.maxChange).toBe(null)
    expect(res.body.stat.minValue).toBe(-10)
    expect(res.body.stat.maxValue).toBe(10)
    expect(res.body.stat.minTimeBetweenUpdates).toBe(0)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_CREATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should not create a stat for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .post(`/games/${otherGame.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not create a stat for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .post('/games/99999/game-stats')
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a stat with a duplicate internal name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ internalName: 'levels-completed' })).one()
    await (<EntityManager>global.em).persistAndFlush(stat)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        internalName: ['A stat with the internalName \'levels-completed\' already exists']
      }
    })
  })

  it('should create a stat with a duplicate internal name for another game', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([otherGame]).state(() => ({ internalName: 'levels-completed' })).one()
    await (<EntityManager>global.em).persistAndFlush(stat)

    await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'levels-completed', name: 'Levels completed', defaultValue: 0, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should create a stat with no min value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: false, minTimeBetweenUpdates: 0, minValue: null, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('buildings-built')
    expect(res.body.stat.minValue).toBe(null)
  })

  it('should create a stat with no max value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: null, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('buildings-built')
    expect(res.body.stat.maxValue).toBe(null)
  })

  it('should create a stat with no max change', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe('buildings-built')
    expect(res.body.stat.maxChange).toBe(null)
  })

  it('should not create a stat with a max change equal to 0', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: 0 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        maxChange: ['maxChange must be greater than 0']
      }
    })
  })

  it('should not create a stat with a max change less than 0', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: false, minTimeBetweenUpdates: 0, minValue: -10, maxValue: 10, maxChange: -10 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        maxChange: ['maxChange must be greater than 0']
      }
    })
  })

  it('should gracefully handle mysql out of range errors', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .post(`/games/${game.id}/game-stats`)
      .send({ internalName: 'buildings-built', name: 'Buildings built', defaultValue: 5, global: false, minTimeBetweenUpdates: 999_999_999_999_999, minValue: -10, maxValue: 10, maxChange: null })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        minTimeBetweenUpdates: ['Value is out of range']
      }
    })
  })
})
