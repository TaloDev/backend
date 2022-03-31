import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-key.service'
import UserFactory from '../../../fixtures/UserFactory'
import GameFactory from '../../../fixtures/GameFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import Player from '../../../../src/entities/player'
import GameStatFactory from '../../../fixtures/GameStatFactory'
import GameStat from '../../../../src/entities/game-stat'
import PlayerGameStatFactory from '../../../fixtures/PlayerGameStatFactory'

const baseUrl = '/v1/game-stats'

describe('Game stats API service - put', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string
  let player: Player

  const setTokenScopes = async (scopes: APIKeyScope[]) => {
    apiKey.scopes = scopes
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)
  }

  const createStat = async (props: Partial<GameStat>) => {
    const stat = await new GameStatFactory([apiKey.game]).with(() => ({ ...props })).one()
    const em: EntityManager  = app.context.em
    em.persist(stat)

    return stat
  }

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    const game = await new GameFactory(user.organisation).one()
    apiKey = new APIKey(game, user)

    player = await new PlayerFactory([game]).one()

    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush([apiKey, player])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a player stat if the scope is valid', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 10, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a player stat the scope is not valid', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99 })
    await setTokenScopes([])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 10, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not create a player stat for a missing player', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 10, aliasId: 12345 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create a player stat if the last update was less than the min time between updates', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99, minTimeBetweenUpdates: 10 })
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).one()
    await (<EntityManager>app.context.em).persistAndFlush(playerStat)
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 80, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat cannot be updated more often than every 10 seconds' })
  })

  it('should not create a player stat if the change is greater than the max change', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 100, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat change cannot be more than 99' })
  })

  it('should create a player stat if there is no max change', async () => {
    const stat = await createStat({ maxValue: 999, defaultValue: 1, maxChange: null })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 998, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a player stat if the change would bring the value below the min value', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99, minValue: -1, defaultValue: 0 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: -2, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat would go below the minValue of -1' })
  })

  it('should create a player stat if there is no min value', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99, minValue: null, defaultValue: 0 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: -99, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should not create a player stat if the change would bring the value above the max value', async () => {
    const stat = await createStat({ maxChange: 99, maxValue: 3, defaultValue: 0 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 4, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Stat would go above the maxValue of 3' })
  })

  it('should create a player stat if there is no max value', async () => {
    const stat = await createStat({ maxValue: null, maxChange: 99, defaultValue: 0 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 99, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })

  it('should update an existing player stat', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99, defaultValue: 0, global: false })
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).with(() => ({ value: 10, createdAt: new Date(2021, 1, 1) })).one()
    await (<EntityManager>app.context.em).persistAndFlush(playerStat)
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 50, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerStat.value).toBe(60)
  })

  it('should increment global stats', async () => {
    const stat = await createStat({ maxValue: 999, maxChange: 99, defaultValue: 0, global: true, globalValue: 0 })
    await setTokenScopes([APIKeyScope.WRITE_GAME_STATS])

    const res = await request(app.callback())
      .put(`${baseUrl}/${stat.internalName}`)
      .send({ change: 50, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.playerStat.value).toBe(50)

    const updatedStat = await (<EntityManager>app.context.em).getRepository(GameStat).findOne(stat.id, { refresh: true })
    expect(updatedStat.globalValue).toBe(50)
  })

  it('should not update a non-existent stat', async () => {
    const res = await request(app.callback())
      .put(`${baseUrl}/blah`)
      .send({ change: 50, aliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
