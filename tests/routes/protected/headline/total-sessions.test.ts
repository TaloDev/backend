import { sub, format } from 'date-fns'
import request from 'supertest'
import { v4 } from 'uuid'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Headline - total sessions', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the total number of sessions this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(10)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: player.aliases[0].id,
          game_id: game.id,
          dev_build: false,
          started_at: startDate,
          ended_at: endDate,
        })),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/total_sessions`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(10)
  })

  it('should not return dev build sessions without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(5)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: player.aliases[0].id,
          game_id: game.id,
          dev_build: true,
          started_at: startDate,
          ended_at: endDate,
        })),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/total_sessions`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build sessions with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(5)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: player.aliases[0].id,
          game_id: game.id,
          dev_build: true,
          started_at: startDate,
          ended_at: endDate,
        })),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/total_sessions`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(5)
  })
})
