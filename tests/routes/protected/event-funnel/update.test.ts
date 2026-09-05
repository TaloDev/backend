import { addSeconds } from 'date-fns'
import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - update', () => {
  it('should update a funnels fields', async () => {
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
    const funnelId = createRes.body.funnel.id

    const res = await request(app)
      .patch(`/games/${game.id}/event-funnels/${funnelId}`)
      .send({ name: 'Funnel v2', maxGap: 120 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.funnel).toMatchObject({
      name: 'Funnel v2',
      maxGap: 120,
    })
  })

  it('should clear the steps on a funnel', async () => {
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
    const funnelId = createRes.body.funnel.id

    const res = await request(app)
      .patch(`/games/${game.id}/event-funnels/${funnelId}`)
      .send({
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Item Used', props: { ruleMode: 'and', rules: [] } },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.funnel.steps).toEqual([
      { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
      { name: 'Item Used', props: { ruleMode: 'and', rules: [] } },
    ])
  })

  it('should bust the cached results on update', async () => {
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
    const funnelId = createRes.body.funnel.id

    const get = () =>
      request(app)
        .get(`/games/${game.id}/event-funnels/${funnelId}`)
        .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
        .auth(token, { type: 'bearer' })

    const cached = await get().expect(200)
    expect(cached.body.funnel.name).toBe('Funnel')

    await request(app)
      .patch(`/games/${game.id}/event-funnels/${funnelId}`)
      .send({ name: 'Funnel v2' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const fresh = await get().expect(200)
    expect(fresh.body.funnel.name).toBe('Funnel v2')
  })

  it('should return 404 for a non-existent funnel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .patch(`/games/${game.id}/event-funnels/99999`)
      .send({ name: 'Nope' })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should reject duplicate step names on update', async () => {
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
    const funnelId = createRes.body.funnel.id

    await request(app)
      .patch(`/games/${game.id}/event-funnels/${funnelId}`)
      .send({
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })
})
