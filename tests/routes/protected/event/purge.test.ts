import request from 'supertest'
import EventRetention from '../../../../src/entities/event-retention.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { UserType } from '../../../../src/entities/user.js'
import EventFactory from '../../../fixtures/EventFactory.js'
import GameFactory from '../../../fixtures/GameFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Event - purge', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const player = await new PlayerFactory([game]).one()
      await em.persist(player).flush()

      const events = await new EventFactory([player])
        .state(() => ({ name: 'Open inventory' }))
        .many(2)

      await em.persist(player).flush()
      await clickhouse.insert({
        table: 'events',
        values: events.map((event) => event.toInsertable()),
        format: 'JSONEachRow',
      })
      await clickhouse.insert({
        table: 'event_props',
        values: events.flatMap((event) => event.getInsertableProps()),
        format: 'JSONEachRow',
      })

      const res = await request(app)
        .delete(`/games/${game.id}/events/purge`)
        .query({ eventName: 'Open inventory' })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode !== 200) {
        return
      }

      expect(res.body).toStrictEqual({ purged: 2 })

      const remainingEvents = await clickhouse
        .query({ query: 'SELECT count() AS count FROM events', format: 'JSONEachRow' })
        .then((res) => res.json<{ count: string }>())
      expect(Number(remainingEvents[0].count)).toBe(0)

      const remainingProps = await clickhouse
        .query({ query: 'SELECT count() AS count FROM event_props', format: 'JSONEachRow' })
        .then((res) => res.json<{ count: string }>())
      expect(Number(remainingProps[0].count)).toBe(0)

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.EVENTS_PURGED,
        game,
      })
      expect(activity?.extra).toMatchObject({ eventName: 'Open inventory', count: 2 })
    },
  )

  it('should keep the retention config so events can be reset', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    await em.persist(new EventRetention(game, 'Open inventory', 30)).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/events/purge`)
      .query({ eventName: 'Open inventory' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body).toStrictEqual({ purged: 0 })
    expect(await em.repo(EventRetention).count({ game })).toBe(1)
  })

  it("should not touch another game's events with the same name", async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const otherGame = await new GameFactory(organisation).one()
    await em.persist(otherGame).flush()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await em.persist(otherPlayer).flush()

    const otherEvents = await new EventFactory([otherPlayer])
      .state(() => ({ name: 'Open inventory' }))
      .many(1)

    await em.persist(otherPlayer).flush()
    await clickhouse.insert({
      table: 'events',
      values: otherEvents.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .delete(`/games/${game.id}/events/purge`)
      .query({ eventName: 'Open inventory' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body).toStrictEqual({ purged: 0 })

    const remaining = await clickhouse
      .query({ query: 'SELECT count() AS count FROM events', format: 'JSONEachRow' })
      .then((res) => res.json<{ count: string }>())
    expect(Number(remaining[0].count)).toBe(1)
  })
})
