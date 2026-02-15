import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { sub, format } from 'date-fns'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import PlayerAlias from '../../../../src/entities/player-alias'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'

describe('Headline - unique event submitters', () => {
  const startDate = format(sub(new Date(), { days: 7 }), 'yyyy-MM-dd')
  const endDate = format(new Date(), 'yyyy-MM-dd')

  it('should return the correct number of unique event submitters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const players = await new PlayerFactory([game]).state(async (player) => {
      const alias = await new PlayerAliasFactory(player).one()
      return {
        aliases: new Collection<PlayerAlias>(player, [alias])
      }
    }).many(4)

    const validEvents = await new EventFactory([players[0]]).many(3)
    const validEventsButNotThisWeek = await new EventFactory([players[1]]).state(() => ({
      createdAt: sub(new Date(), { weeks: 2 })
    })).many(3)
    const moreValidEvents = await new EventFactory([players[2]]).many(3)

    await em.persist(players).flush()
    await clickhouse.insert({
      table: 'events',
      values: [
        ...validEvents,
        ...validEventsButNotThisWeek,
        ...moreValidEvents
      ].map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(2)
  })

  it('should not return dev build unique event submitters without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    const validEvents = await new EventFactory([player]).many(3)
    await clickhouse.insert({
      table: 'events',
      values: validEvents.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build unique event submitters with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().state(async (player) => {
      const alias = await new PlayerAliasFactory(player).one()
      return {
        aliases: new Collection<PlayerAlias>(player, [alias])
      }
    }).one()
    await em.persist(player).flush()

    const validEvents = await new EventFactory([player]).many(3)
    await clickhouse.insert({
      table: 'events',
      values: validEvents.map((event) => event.toInsertable()),
      format: 'JSONEachRow'
    })

    const res = await request(app)
      .get(`/games/${game.id}/headlines/unique_event_submitters`)
      .query({ startDate, endDate })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(1)
  })
})
