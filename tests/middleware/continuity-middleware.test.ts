import { subHours } from 'date-fns'
import request from 'supertest'
import { APIKeyScope } from '../../src/entities/api-key.js'
import GameStatFactory from '../fixtures/GameStatFactory.js'
import PlayerFactory from '../fixtures/PlayerFactory.js'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken.js'

describe('Continuity middleware', () => {
  it("should not set the createdAt of the player stat to the continuity date if the write continuity requests scope isn't set", async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_STATS])
    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ maxValue: 999, maxChange: 99 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    const continuityDate = subHours(new Date(), 1)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(res.body.playerStat.createdAt).not.toBe(continuityDate.toISOString())
  })

  it('should not set the createdAt of the player stat to the continuity date if the timestamp is invalid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.WRITE_GAME_STATS,
      APIKeyScope.WRITE_CONTINUITY_REQUESTS,
    ])
    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ maxValue: 999, maxChange: 99 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    const continuityDate = subHours(new Date(), 1)

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(Math.ceil(continuityDate.getTime() / 1000)))
      .expect(200)

    expect(res.body.playerStat.createdAt).not.toBe(continuityDate.toISOString())
  })

  it('should ignore a future continuity timestamp', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.WRITE_GAME_STATS,
      APIKeyScope.WRITE_CONTINUITY_REQUESTS,
    ])
    const stat = await new GameStatFactory([apiKey.game])
      .state(() => ({ maxValue: 999, maxChange: 99 }))
      .one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persist([stat, player]).flush()

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const before = Date.now()

    const res = await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 10 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(futureDate.getTime()))
      .expect(200)

    const createdAt = new Date(res.body.playerStat.createdAt).getTime()
    expect(createdAt).toBeLessThanOrEqual(before + 1000)
    expect(createdAt).toBeLessThan(futureDate.getTime())
  })
})
