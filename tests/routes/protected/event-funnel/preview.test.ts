import { addSeconds } from 'date-fns'
import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - preview', () => {
  it('should compute a basic funnel with percentages and avg time to convert', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const playerA = await new PlayerFactory([game]).one()
    const playerB = await new PlayerFactory([game]).one()
    await em.persist([playerA, playerB]).flush()
    const aliasA = playerA.aliases.getItems()[0]
    const aliasB = playerB.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      await new EventFactory([playerA])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias: aliasA }))
        .one(),
      await new EventFactory([playerA])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 30),
          playerAlias: aliasA,
        }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({
          name: 'Game Started',
          createdAt: addSeconds(baseTime, 5),
          playerAlias: aliasB,
        }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 45),
          playerAlias: aliasB,
        }))
        .one(),
    ]
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send({
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps).toEqual([
      { eventName: 'Game Started', players: 2, percentage: 100, avgSecondsToNext: 35 },
      { eventName: 'Chest Looted', players: 2, percentage: 100, avgSecondsToNext: null },
    ])
  })

  it('should exclude out-of-order events and events outside the max gap', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const playerA = await new PlayerFactory([game]).one()
    const playerB = await new PlayerFactory([game]).one()
    await em.persist([playerA, playerB]).flush()
    const aliasA = playerA.aliases.getItems()[0]
    const aliasB = playerB.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      // playerA: loot happens before game start
      await new EventFactory([playerA])
        .state(() => ({ name: 'Chest Looted', createdAt: baseTime, playerAlias: aliasA }))
        .one(),
      await new EventFactory([playerA])
        .state(() => ({
          name: 'Game Started',
          createdAt: addSeconds(baseTime, 30),
          playerAlias: aliasA,
        }))
        .one(),
      // playerB: start and loot 90s apart, beyond the 60s max gap
      await new EventFactory([playerB])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias: aliasB }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 90),
          playerAlias: aliasB,
        }))
        .one(),
    ]
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send({
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps[0].players).toBe(2)
    expect(res.body.result.steps[1].players).toBe(0)
  })

  it('should exclude events outside the date window', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()
    const alias = player.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      await new EventFactory([player])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias: alias }))
        .one(),
      await new EventFactory([player])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 30),
          playerAlias: alias,
        }))
        .one(),
    ]
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const res = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send({
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
        startDate: '2026-09-20',
        endDate: '2026-09-21',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps[0].players).toBe(0)
    expect(res.body.result.steps[0].percentage).toBe(0)
    expect(res.body.result.steps[1].players).toBe(0)
    expect(res.body.result.steps[1].percentage).toBe(0)
  })

  it('should exclude dev build players unless dev data is included', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()
    const alias = player.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      await new EventFactory([player])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias: alias }))
        .one(),
      await new EventFactory([player])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 30),
          playerAlias: alias,
        }))
        .one(),
    ]
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const body = {
      steps: [
        { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
        { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
      ],
      maxGap: 60,
      startDate: '2026-09-01',
      endDate: '2026-09-02',
    }

    const withoutDev = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send(body)
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(withoutDev.body.result.steps[0].players).toBe(0)

    const withDev = await request(app)
      .post(`/games/${game.id}/event-funnels/preview`)
      .send(body)
      .set('x-talo-include-dev-data', '1')
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(withDev.body.result.steps[0].players).toBe(1)
  })
})
