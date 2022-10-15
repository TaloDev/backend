import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import { subHours } from 'date-fns'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

const baseUrl = '/v1/leaderboards'

describe('Leaderboard API service - post', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a leaderboard entry if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    const res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
    expect(res.body.entry.position).toBeDefined()
  })

  it('should not create a leaderboard entry if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should not create a leaderboard entry if the alias doesn\'t exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99')
      .expect(404)
  })

  it('should not create a leaderboard entry if the leaderboard doesn\'t exist', async () => {
    const [, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])

    await request(app.callback())
      .post(`${baseUrl}/blah/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99')
      .expect(404)
  })

  it('should update an existing entry for unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).with(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    let res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 360 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).toBe(prevId)
    expect(res.body.entry.score).toBe(360)
    expect(res.body.updated).toBe(true)
  })

  it('should update an existing entry\'s created at for unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).with(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()

    const originalDate = subHours(new Date(), 2)

    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({
      score: 100,
      createdAt: originalDate,
      playerAlias: player.aliases[0]
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard, entry])

    const res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(true)

    expect(new Date(res.body.entry.createdAt).getTime()).toBeGreaterThan(originalDate.getTime())
  })

  it('should add new entries for non-unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).with(() => ({ unique: false })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    let res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 360 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).not.toBe(prevId)
    expect(res.body.entry.score).toBe(360)
  })

  it('should not update an existing entry if the score is less than the current score and the sortMode is DESC', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).with(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    let res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)

    res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 290 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
  })

  it('should not update an existing entry if the score is greater than the current score and the sortMode is ASC', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).with(() => ({ unique: true, sortMode: LeaderboardSortMode.ASC })).one()
    await (<EntityManager>app.context.em).persistAndFlush([player, leaderboard])

    let res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)

    res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 310 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
  })

  it('should return the correct position if there are dev entries but no dev data header sent', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).with(() => ({ unique: false, sortMode: LeaderboardSortMode.ASC })).one()

    const devPlayer = await new PlayerFactory([apiKey.game]).state('dev build').one()
    const devEntry = await new LeaderboardEntryFactory(leaderboard, [devPlayer]).with(() => ({ score: 100 })).one()

    await (<EntityManager>app.context.em).persistAndFlush([leaderboard, player, devEntry])

    const res = await request(app.callback())
      .post(`${baseUrl}/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)
  })
})
