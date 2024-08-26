import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import { subHours } from 'date-fns'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Leaderboard API service - post', () => {
  it('should create a leaderboard entry if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    const res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
    expect(res.body.entry.position).toBeDefined()
  })

  it('should not create a leaderboard entry if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not create a leaderboard entry if the alias doesn\'t exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99')
      .expect(404)
  })

  it('should not create a leaderboard entry if the leaderboard doesn\'t exist', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])

    await request(global.app)
      .post('/v1/leaderboards/blah/entries')
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99')
      .expect(404)
  })

  it('should update an existing entry for unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    let res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 360 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).toBe(prevId)
    expect(res.body.entry.score).toBe(360)
    expect(res.body.updated).toBe(true)
  })

  it('should update an existing entry\'s created at for unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()

    const originalDate = subHours(new Date(), 2)

    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({
      score: 100,
      createdAt: originalDate,
      playerAlias: player.aliases[0]
    })).one()

    await (<EntityManager>global.em).persistAndFlush([player, leaderboard, entry])

    const res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(true)

    expect(new Date(res.body.entry.createdAt).getTime()).toBeGreaterThan(originalDate.getTime())
  })

  it('should add new entries for non-unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: false })).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    let res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 360 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).not.toBe(prevId)
    expect(res.body.entry.score).toBe(360)
  })

  it('should not update an existing entry if the score is less than the current score and the sortMode is DESC', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    let res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)

    res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 290 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
  })

  it('should not update an existing entry if the score is greater than the current score and the sortMode is ASC', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: true, sortMode: LeaderboardSortMode.ASC })).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    let res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)

    res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 310 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
  })

  it('should return the correct position if there are dev entries but no dev data header sent', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: false, sortMode: LeaderboardSortMode.ASC })).one()

    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    const devEntry = await new LeaderboardEntryFactory(leaderboard, [devPlayer]).state(() => ({ score: 100 })).one()

    await (<EntityManager>global.em).persistAndFlush([leaderboard, player, devEntry])

    const res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)
  })

  it('should set the createdAt for the entry to the continuity date', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS, APIKeyScope.WRITE_CONTINUITY_REQUESTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush([player, leaderboard])

    const continuityDate = subHours(new Date(), 1)

    const res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(new Date(res.body.entry.createdAt).getHours()).toBe(continuityDate.getHours())
  })

  it('should update an existing entry\'s created at to the continuity date for unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS, APIKeyScope.WRITE_CONTINUITY_REQUESTS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()

    const originalDate = subHours(new Date(), 2)
    const continuityDate = subHours(new Date(), 1)

    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({
      score: 100,
      createdAt: originalDate,
      playerAlias: player.aliases[0]
    })).one()

    await (<EntityManager>global.em).persistAndFlush([player, leaderboard, entry])

    const res = await request(global.app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(new Date(res.body.entry.createdAt).getHours()).toBe(continuityDate.getHours())
  })
})
