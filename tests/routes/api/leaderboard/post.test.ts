import { Collection } from '@mikro-orm/mysql'
import { randText } from '@ngneat/falso'
import { subHours, subMinutes } from 'date-fns'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import { LeaderboardSortMode } from '../../../../src/entities/leaderboard'
import LeaderboardEntry from '../../../../src/entities/leaderboard-entry'
import LeaderboardEntryProp from '../../../../src/entities/leaderboard-entry-prop'
import PlayerGroupRule, {
  PlayerGroupRuleCastType,
  PlayerGroupRuleName,
} from '../../../../src/entities/player-group-rule'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

describe('Leaderboard API - create', () => {
  it('should create a leaderboard entry if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persistAndFlush([player, leaderboard])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
    expect(res.body.entry.position).toBe(0)
  })

  it('should not create a leaderboard entry if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persistAndFlush([player, leaderboard])

    await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it("should not create a leaderboard entry if the alias doesn't exist", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persistAndFlush([player, leaderboard])

    await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99')
      .expect(404)
  })

  it("should not create a leaderboard entry if the leaderboard doesn't exist", async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])

    await request(app)
      .post('/v1/leaderboards/blah/entries')
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99')
      .expect(404)
  })

  it('should update an existing entry for unique leaderboards', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    let res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 360 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).toBe(prevId)
    expect(res.body.entry.score).toBe(360)
    expect(res.body.updated).toBe(true)
  })

  it("should update an existing entry's created at for unique leaderboards", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()

    const originalDate = subHours(new Date(), 2)

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 100,
        createdAt: originalDate,
        playerAlias: player.aliases[0],
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
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
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    let res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const prevId = res.body.entry.id
    expect(res.body.entry.score).toBe(300)

    res = await request(app)
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
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    let res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)

    res = await request(app)
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
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.ASC }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    let res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)

    res = await request(app)
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
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false, sortMode: LeaderboardSortMode.ASC }))
      .one()

    const devPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    const devEntry = await new LeaderboardEntryFactory(leaderboard, [devPlayer])
      .state(() => ({ score: 100 }))
      .one()

    await em.persistAndFlush([leaderboard, player, devEntry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)
  })

  it('should set the createdAt for the entry to the continuity date', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.WRITE_LEADERBOARDS,
      APIKeyScope.WRITE_CONTINUITY_REQUESTS,
    ])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()
    await em.persistAndFlush([player, leaderboard])

    const continuityDate = subHours(new Date(), 1)

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(new Date(res.body.entry.createdAt).getHours()).toBe(continuityDate.getHours())
  })

  it("should update an existing entry's created at to the continuity date for unique leaderboards", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.WRITE_LEADERBOARDS,
      APIKeyScope.WRITE_CONTINUITY_REQUESTS,
    ])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()

    const originalDate = subHours(new Date(), 2)
    const continuityDate = subHours(new Date(), 1)

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 100,
        createdAt: originalDate,
        playerAlias: player.aliases[0],
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(new Date(res.body.entry.createdAt).getHours()).toBe(continuityDate.getHours())
  })

  it('should create entries with props', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: [
          { key: 'key1', value: 'value1' },
          { key: 'key2', value: 'value2' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.entry.props).toStrictEqual([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
    ])
  })

  it("should update an existing entry's props", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'key1', 'value1'),
          new LeaderboardEntryProp(entry, 'delete-me', 'delete-me'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: [
          { key: 'key2', value: 'value2' },
          { key: 'delete-me', value: null },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(true)

    expect(res.body.entry.props).toStrictEqual([
      { key: 'key2', value: 'value2' },
      { key: 'key1', value: 'value1' },
    ])
  })

  it('should delete props when only null values are sent', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'delete-me', 'delete-me'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: [{ key: 'delete-me', value: null }],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(true)
    expect(res.body.entry.props).toStrictEqual([])
  })

  it('should return a 400 if props are not an array', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: {
          key1: 'value1',
          key2: 'value2',
        },
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Props must be an array'],
      },
    })
  })

  it('should return the correct position accounting for hidden entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC, unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const hiddenEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ score: 250 }))
      .hidden()
      .one()
    await em.persistAndFlush(hiddenEntry)

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 200 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(1)
  })

  it('should return the correct position accounting for archived entries', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ sortMode: LeaderboardSortMode.DESC, unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    const archivedEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ score: 250 }))
      .archived()
      .one()
    await em.persistAndFlush(archivedEntry)

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 200 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(1)
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '1',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop key length (129) exceeds 128 characters'],
      },
    })
  })

  it('should reject props where the value is greater than 512 characters', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 }),
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop value length (513) exceeds 512 characters'],
      },
    })
  })

  it('should correctly return the position for an ascending leaderboard', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false, sortMode: LeaderboardSortMode.ASC }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    let res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)

    // higher than above
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 400 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(1)

    // same result as above
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 400 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(2)

    // lower than above
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 350 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(1)

    // lowest result
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 100 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)
  })

  it('should correctly return the position for a descending leaderboard', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false, sortMode: LeaderboardSortMode.DESC }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    let res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)

    // lower than above
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 200 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(1)

    // same result as above
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 200 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(2)

    // higher than above
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 250 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(1)

    // highest result
    res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 500 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)
  })

  it('should return position 0 when the first entry in a unique leaderboard is hidden', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: true, sortMode: LeaderboardSortMode.DESC }))
      .one()

    const hiddenEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ score: 300 }))
      .hidden()
      .one()
    await em.persistAndFlush([player, leaderboard, hiddenEntry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 200 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.position).toBe(0)
  })

  it('should join eligible groups based on leaderboard scores', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game]).one()

    const rule = new PlayerGroupRule(
      PlayerGroupRuleName.GTE,
      `leaderboardEntryScore.${leaderboard.internalName}`,
    )
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['100']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()
    await em.persistAndFlush([player, leaderboard, group])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.playerAlias.player.groups).toStrictEqual([
      {
        id: group.id,
        name: group.name,
      },
    ])
  })

  it('should leave ineligible groups based on leaderboard scores', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        playerAlias: player.aliases[0],
        score: 1,
      }))
      .one()

    const rule = new PlayerGroupRule(
      PlayerGroupRuleName.LTE,
      `leaderboardEntryScore.${leaderboard.internalName}`,
    )
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['5']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game)
      .state(() => ({ rules: [rule] }))
      .one()
    await em.persistAndFlush([player, leaderboard, entry, group])
    await group.checkMembership(em)

    expect(group.members).toHaveLength(1)

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.playerAlias.player.groups).toStrictEqual([])
  })

  it('should create a new entry if uniqueByProps is enabled and props are different', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        uniqueByProps: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'level', '1'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 200,
        props: [{ key: 'level', value: '2' }],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).not.toBe(entry.id)
    expect(res.body.entry.score).toBe(200)
    expect(res.body.updated).toBe(false)
    expect(res.body.entry.props).toStrictEqual([{ key: 'level', value: '2' }])
  })

  it('should not create a new entry if uniqueByProps is enabled and props are the same', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        uniqueByProps: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'level', '1'),
          new LeaderboardEntryProp(entry, 'difficulty', 'hard'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 200,
        props: [
          { key: 'level', value: '1' },
          { key: 'difficulty', value: 'hard' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).toBe(entry.id)
    expect(res.body.entry.score).toBe(200)
    expect(res.body.updated).toBe(true)
  })

  it('should not create a new entry if uniqueByProps is enabled and no props are specified on either entry', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        uniqueByProps: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 100,
        playerAlias: player.aliases[0],
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({ score: 200 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).toBe(entry.id)
    expect(res.body.entry.score).toBe(200)
    expect(res.body.updated).toBe(true)
  })

  it('should create a new entry if uniqueByProps is enabled and the number of props differs', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        uniqueByProps: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'level', '1'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 200,
        props: [
          { key: 'level', value: '1' },
          { key: 'difficulty', value: 'hard' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).not.toBe(entry.id)
    expect(res.body.entry.score).toBe(200)
    expect(res.body.updated).toBe(false)
    expect(res.body.entry.props).toHaveLength(2)
    expect(res.body.entry.props).toEqual(
      expect.arrayContaining([
        { key: 'level', value: '1' },
        { key: 'difficulty', value: 'hard' },
      ]),
    )
  })

  it('should not create a new entry if uniqueByProps is enabled and the player has multiple entries but the latest entry props match', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        uniqueByProps: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 100,
        playerAlias: player.aliases[0],
        createdAt: subMinutes(new Date(), 10),
      }))
      .one()
    const newerEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'level', '1'),
          new LeaderboardEntryProp(entry, 'difficulty', 'hard'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, oldEntry, newerEntry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 200,
        props: [
          { key: 'level', value: '1' },
          { key: 'difficulty', value: 'hard' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.id).toBe(newerEntry.id)
    expect(res.body.entry.score).toBe(200)
    expect(res.body.updated).toBe(true)
  })

  it('should keep creating new entries if uniqueByProps is enabled and the latest entry props do not match incoming ones', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        uniqueByProps: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state((entry) => ({
        score: 100,
        playerAlias: player.aliases[0],
        props: new Collection<LeaderboardEntryProp>(entry, [
          new LeaderboardEntryProp(entry, 'level', '1'),
          new LeaderboardEntryProp(entry, 'difficulty', 'hard'),
        ]),
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    // level 2
    const level2Res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 200,
        props: [
          { key: 'level', value: '2' },
          { key: 'difficulty', value: 'hard' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(level2Res.body.entry.id).not.toBe(entry.id)
    expect(level2Res.body.entry.score).toBe(200)
    expect(level2Res.body.updated).toBe(false)

    const level2EntryId = level2Res.body.entry.id

    // level 3
    const level3Res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 300,
        props: [
          { key: 'level', value: '3' },
          { key: 'difficulty', value: 'hard' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(level3Res.body.entry.id).not.toBe(level2EntryId)
    expect(level3Res.body.entry.score).toBe(300)
    expect(level3Res.body.updated).toBe(false)

    // level 2 again
    const level2AgainRes = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 250,
        props: [
          { key: 'level', value: '2' },
          { key: 'difficulty', value: 'hard' },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(level2AgainRes.body.entry.id).toBe(level2EntryId)
    expect(level2AgainRes.body.entry.score).toBe(250)
    expect(level2AgainRes.body.updated).toBe(true)
  })

  it('should handle concurrent requests for non-unique leaderboards and create only one entry per request', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ unique: false }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        request(app)
          .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
          .send({ score: 100 })
          .auth(token, { type: 'bearer' })
          .set('x-talo-alias', String(player.aliases[0].id)),
      ),
    )

    results.forEach((res) => {
      expect(res.status).toBe(200)
      expect(res.body.entry.score).toBe(100)
      expect(res.body.updated).toBe(false)
    })

    const uniqueIds = new Set(results.map((res) => res.body.entry.id))
    expect(uniqueIds.size).toBe(3)
  })

  it('should handle concurrent requests for unique leaderboards and create only one entry', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
          .send({ score: 100 + 50 * i })
          .auth(token, { type: 'bearer' })
          .set('x-talo-alias', String(player.aliases[0].id)),
      ),
    )

    results.forEach((res) => {
      expect(res.status).toBe(200)
    })

    const uniqueIds = new Set(results.map((res) => res.body.entry.id))
    expect(uniqueIds.size).toBe(1)

    const entryCount = await em.repo(LeaderboardEntry).count({
      leaderboard,
      playerAlias: player.aliases[0],
    })
    expect(entryCount).toBe(1)

    // the final score should be 200 (highest score for DESC)
    const finalEntry = await em.repo(LeaderboardEntry).findOneOrFail({
      leaderboard,
      playerAlias: player.aliases[0],
    })
    expect(finalEntry.score).toBe(200)
  })

  it('should handle prop size errors during unique entry creation', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()
    await em.persistAndFlush([player, leaderboard])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 100,
        props: [
          {
            key: 'description',
            value: randText({ charCount: 513 }),
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop value length (513) exceeds 512 characters'],
      },
    })

    const entryCount = await em.repo(LeaderboardEntry).count({
      leaderboard,
      playerAlias: player.aliases[0],
    })
    expect(entryCount).toBe(0)
  })

  it('should handle prop size errors when score would not be updated', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({
        unique: true,
        sortMode: LeaderboardSortMode.DESC,
      }))
      .one()

    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({
        score: 200,
        playerAlias: player.aliases[0],
      }))
      .one()

    await em.persistAndFlush([player, leaderboard, entry])

    const res = await request(app)
      .post(`/v1/leaderboards/${leaderboard.internalName}/entries`)
      .send({
        score: 50,
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 513 }),
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    // should pass because the entry wasn't going to be updated
    expect(res.body.entry.score).toBe(200)
    expect(res.body.updated).toBe(false)
  })

  it('should handle spaces in the internal name', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_LEADERBOARDS])
    const player = await new PlayerFactory([apiKey.game]).one()
    const leaderboard = await new LeaderboardFactory([apiKey.game])
      .state(() => ({ internalName: 'with space' }))
      .one()
    await em.persist([player, leaderboard]).flush()

    const res = await request(app)
      .post(`/v1/leaderboards/${encodeURIComponent(leaderboard.internalName)}/entries`)
      .send({ score: 300 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.entry.score).toBe(300)
    expect(res.body.updated).toBe(false)
    expect(res.body.entry.position).toBe(0)
  })
})
