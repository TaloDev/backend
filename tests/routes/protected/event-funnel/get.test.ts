import { addSeconds } from 'date-fns'
import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - get', () => {
  it('should return a funnel with computed results', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()
    const playerAlias = player.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      await new EventFactory([player])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias }))
        .one(),
      await new EventFactory([player])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 30),
          playerAlias,
        }))
        .one(),
    ]
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const createRes = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const res = await request(app)
      .get(`/games/${game.id}/event-funnels/${createRes.body.funnel.id}`)
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.funnel.name).toBe('Funnel')
    expect(res.body.result.steps).toEqual([
      { eventName: 'Game Started', players: 1, percentage: 100, avgSecondsToNext: 30 },
      { eventName: 'Chest Looted', players: 1, percentage: 100, avgSecondsToNext: null },
    ])
    expect(res.body.result.lastUpdatedAt).toEqual(expect.any(Number))
  })

  it('should include dev build players when dev data is requested', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()
    const playerAlias = player.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const events = [
      await new EventFactory([player])
        .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias }))
        .one(),
      await new EventFactory([player])
        .state(() => ({
          name: 'Chest Looted',
          createdAt: addSeconds(baseTime, 30),
          playerAlias,
        }))
        .one(),
    ]
    await clickhouse.insert({
      table: 'events',
      values: events.map((event) => event.toInsertable()),
      format: 'JSONEachRow',
    })

    const createRes = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const withoutDev = await request(app)
      .get(`/games/${game.id}/event-funnels/${createRes.body.funnel.id}`)
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(withoutDev.body.result.steps[0].players).toBe(0)

    const withDev = await request(app)
      .get(`/games/${game.id}/event-funnels/${createRes.body.funnel.id}`)
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .set('x-talo-include-dev-data', '1')
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(withDev.body.result.steps[0].players).toBe(1)
  })

  it('should reject a missing date window', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const createRes = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await request(app)
      .get(`/games/${game.id}/event-funnels/${createRes.body.funnel.id}`)
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should reject a partial date window', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const createRes = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await request(app)
      .get(`/games/${game.id}/event-funnels/${createRes.body.funnel.id}`)
      .query({ startDate: '2026-09-01' })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should return 404 for a non-existent funnel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .get(`/games/${game.id}/event-funnels/99999`)
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not return a funnel from another game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [otherOrganisation, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    const [otherToken] = await createUserAndToken({}, otherOrganisation)

    const createRes = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await request(app)
      .get(`/games/${otherGame.id}/event-funnels/${createRes.body.funnel.id}`)
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .auth(otherToken, { type: 'bearer' })
      .expect(404)
  })
})
