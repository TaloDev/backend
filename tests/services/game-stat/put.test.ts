import request from 'supertest'
import GameStatFactory from '../../fixtures/GameStatFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Game stat service - put', () => {
  it('should update the name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ internalName: stat.internalName, name: 'New name', global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.name).toBe('New name')

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'name: New name'
    })
  })

  it('should update the global status', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ global: false })).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ global: true, internalName: stat.internalName, name: stat.name, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.global).toBe(true)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'global: true'
    })
  })

  it('should update the max change', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ maxChange: 90, internalName: stat.internalName, name: stat.name, global: stat.global, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.maxChange).toBe(90)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'maxChange: 90'
    })
  })

  it('should update the min value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: -600,
      defaultValue: 0,
      maxValue: 600
    })).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ minValue: -300, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.minValue).toBe(-300)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'minValue: -300'
    })
  })

  it('should update the max value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: -100,
      defaultValue: 0,
      maxValue: 100
    })).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ maxValue: 200, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.maxValue).toBe(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'maxValue: 200'
    })
  })

  it('should update the default value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: -100,
      maxValue: 300
    })).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ defaultValue: 100, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.defaultValue).toBe(100)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'defaultValue: 100'
    })
  })

  it('should update the min time between updates', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ minTimeBetweenUpdates: 10242, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.minTimeBetweenUpdates).toBe(10242)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'minTimeBetweenUpdates: 10242'
    })
  })

  it('should not update the internal name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ internalName: 'new-internal-name', name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stat.internalName).toBe(stat.internalName)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_UPDATED,
      game,
      extra: {
        statInternalName: res.body.stat.internalName
      }
    })

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': ''
    })
  })

  it('should not update a stat for a game the user does not have access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const stat = await new GameStatFactory([otherGame]).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${otherGame.id}/game-stats/${stat.id}`)
      .send({ internalName: stat.internalName, name: 'New name', global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update a non-existent stat', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).one()

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/31223`)
      .send({ internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, minValue: stat.minValue, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: stat.minTimeBetweenUpdates })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })

  it('should gracefully handle mysql out of range errors', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: -600,
      defaultValue: 0,
      maxValue: 600
    })).one()
    await em.persistAndFlush(stat)

    const res = await request(app)
      .put(`/games/${game.id}/game-stats/${stat.id}`)
      .send({ minValue: stat.minValue, internalName: stat.internalName, name: stat.name, global: stat.global, maxChange: stat.maxChange, maxValue: stat.maxValue, defaultValue: stat.defaultValue, minTimeBetweenUpdates: 999_999_999_999_999 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        minTimeBetweenUpdates: ['Value is out of range']
      }
    })
  })
})
