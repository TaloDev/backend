import { sub, format } from 'date-fns'
import request from 'supertest'
import { v4 } from 'uuid'
import { formatDateForClickHouse } from '../../../../src/lib/clickhouse/formatDateTime'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Headline - average session duration', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the average session duration this week', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const sessionStartDate = new Date(startDate)
    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(3)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: player.aliases[0].id,
          game_id: game.id,
          dev_build: false,
          started_at: formatDateForClickHouse(sessionStartDate),
          ended_at: formatDateForClickHouse(new Date(sessionStartDate.getTime() + 7200000)), // 2 hours later
        })),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/average_session_duration`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body).toStrictEqual({
      hours: 2,
      minutes: 0,
      seconds: 0,
    })
  })

  it('should not include dev build sessions in average duration without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    const sessionStartDate = new Date(startDate)
    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(3)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: player.aliases[0].id,
          game_id: game.id,
          dev_build: true,
          started_at: formatDateForClickHouse(sessionStartDate),
          ended_at: formatDateForClickHouse(new Date(sessionStartDate.getTime() + 7200000)), // 2 hours later
        })),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/average_session_duration`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body).toStrictEqual({
      hours: 0,
      minutes: 0,
      seconds: 0,
    })
  })

  it('should include dev build sessions in average duration with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    const sessionStartDate = new Date(startDate)
    await clickhouse.insert({
      table: 'player_sessions',
      values: Array(3)
        .fill({})
        .map(() => ({
          id: v4(),
          player_id: player.id,
          player_alias_id: player.aliases[0].id,
          game_id: game.id,
          dev_build: true,
          started_at: formatDateForClickHouse(sessionStartDate),
          ended_at: formatDateForClickHouse(new Date(sessionStartDate.getTime() + 7200000)), // 2 hours later
        })),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/average_session_duration`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body).toStrictEqual({
      hours: 2,
      minutes: 0,
      seconds: 0,
    })
  })
})
