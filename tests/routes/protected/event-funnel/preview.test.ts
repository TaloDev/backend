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

  it('should chain distinct events when consecutive steps share a name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const playerA = await new PlayerFactory([game]).one()
    const playerB = await new PlayerFactory([game]).one()
    const playerC = await new PlayerFactory([game]).one()
    await em.persist([playerA, playerB, playerC]).flush()
    const aliasA = playerA.aliases.getItems()[0]
    const aliasB = playerB.aliases.getItems()[0]
    const aliasC = playerC.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      // playerA: two 'Opened' events within the gap -> converts
      await new EventFactory([playerA])
        .state(() => ({ name: 'Opened', createdAt: baseTime, playerAlias: aliasA }))
        .one(),
      await new EventFactory([playerA])
        .state(() => ({ name: 'Opened', createdAt: addSeconds(baseTime, 30), playerAlias: aliasA }))
        .one(),
      // playerB: only one 'Opened' event -> cannot fill two steps
      await new EventFactory([playerB])
        .state(() => ({ name: 'Opened', createdAt: addSeconds(baseTime, 5), playerAlias: aliasB }))
        .one(),
      // playerC: two 'Opened' events beyond the max gap -> does not convert
      await new EventFactory([playerC])
        .state(() => ({ name: 'Opened', createdAt: baseTime, playerAlias: aliasC }))
        .one(),
      await new EventFactory([playerC])
        .state(() => ({ name: 'Opened', createdAt: addSeconds(baseTime, 90), playerAlias: aliasC }))
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
          { name: 'Opened', props: { ruleMode: 'and', rules: [] } },
          { name: 'Opened', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps).toEqual([
      { eventName: 'Opened', players: 3, percentage: 100, avgSecondsToNext: 30 },
      { eventName: 'Opened', players: 1, percentage: 33.33, avgSecondsToNext: null },
    ])
  })

  it('should match a repeated step name to a later event instead of the first occurrence', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const playerA = await new PlayerFactory([game]).one()
    const playerB = await new PlayerFactory([game]).one()
    const playerC = await new PlayerFactory([game]).one()
    const playerD = await new PlayerFactory([game]).one()
    await em.persist([playerA, playerB, playerC, playerD]).flush()
    const aliasA = playerA.aliases.getItems()[0]
    const aliasB = playerB.aliases.getItems()[0]
    const aliasC = playerC.aliases.getItems()[0]
    const aliasD = playerD.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      // playerA: Started -> Failed -> Started, all within the gap -> converts
      await new EventFactory([playerA])
        .state(() => ({ name: 'Started', createdAt: baseTime, playerAlias: aliasA }))
        .one(),
      await new EventFactory([playerA])
        .state(() => ({ name: 'Failed', createdAt: addSeconds(baseTime, 10), playerAlias: aliasA }))
        .one(),
      await new EventFactory([playerA])
        .state(() => ({
          name: 'Started',
          createdAt: addSeconds(baseTime, 20),
          playerAlias: aliasA,
        }))
        .one(),
      // playerB: second Started is beyond the gap after Failed -> does not convert
      await new EventFactory([playerB])
        .state(() => ({ name: 'Started', createdAt: baseTime, playerAlias: aliasB }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({ name: 'Failed', createdAt: addSeconds(baseTime, 10), playerAlias: aliasB }))
        .one(),
      await new EventFactory([playerB])
        .state(() => ({
          name: 'Started',
          createdAt: addSeconds(baseTime, 90),
          playerAlias: aliasB,
        }))
        .one(),
      // playerC: no Started after Failed -> must not reuse the first Started
      await new EventFactory([playerC])
        .state(() => ({ name: 'Started', createdAt: baseTime, playerAlias: aliasC }))
        .one(),
      await new EventFactory([playerC])
        .state(() => ({ name: 'Failed', createdAt: addSeconds(baseTime, 10), playerAlias: aliasC }))
        .one(),
      // playerD: Failed is beyond the gap from Started, so the trailing Started
      // must chain from the (failed) middle step, not the first Started
      await new EventFactory([playerD])
        .state(() => ({ name: 'Started', createdAt: baseTime, playerAlias: aliasD }))
        .one(),
      await new EventFactory([playerD])
        .state(() => ({
          name: 'Failed',
          createdAt: addSeconds(baseTime, 100),
          playerAlias: aliasD,
        }))
        .one(),
      await new EventFactory([playerD])
        .state(() => ({
          name: 'Started',
          createdAt: addSeconds(baseTime, 30),
          playerAlias: aliasD,
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
          { name: 'Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Failed', props: { ruleMode: 'and', rules: [] } },
          { name: 'Started', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
        startDate: '2026-09-01',
        endDate: '2026-09-02',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.result.steps).toEqual([
      { eventName: 'Started', players: 4, percentage: 100, avgSecondsToNext: 10 },
      { eventName: 'Failed', players: 3, percentage: 75, avgSecondsToNext: 10 },
      { eventName: 'Started', players: 1, percentage: 25, avgSecondsToNext: null },
    ])
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
