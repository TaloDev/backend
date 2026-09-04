import { addSeconds } from 'date-fns'
import request from 'supertest'
import EventFactory from '../../../fixtures/EventFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - refresh', () => {
  it('should bust a funnels cached results', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const secondPlayer = await new PlayerFactory([game]).one()
    await em.persist([player, secondPlayer]).flush()
    const playerAlias = player.aliases.getItems()[0]
    const otherAlias = secondPlayer.aliases.getItems()[0]

    const baseTime = new Date('2026-09-01T10:00:00Z')
    const firstEvent = await new EventFactory([player])
      .state(() => ({ name: 'Game Started', createdAt: baseTime, playerAlias }))
      .one()
    await clickhouse.insert({
      table: 'events',
      values: [firstEvent.toInsertable()],
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

    const first = await get().expect(200)
    expect(first.body.result.steps[0].players).toBe(1)

    // cached result should not reflect the new event
    const secondEvent = await new EventFactory([secondPlayer])
      .state(() => ({
        name: 'Game Started',
        createdAt: addSeconds(baseTime, 10),
        playerAlias: otherAlias,
      }))
      .one()
    await clickhouse.insert({
      table: 'events',
      values: [secondEvent.toInsertable()],
      format: 'JSONEachRow',
    })
    const cached = await get().expect(200)
    expect(cached.body.result.steps[0].players).toBe(1)

    await request(app)
      .delete(`/games/${game.id}/event-funnels/${funnelId}/refresh`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const fresh = await get().expect(200)
    expect(fresh.body.result.steps[0].players).toBe(2)
  })

  it('should return 404 for a non-existent funnel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .delete(`/games/${game.id}/event-funnels/99999/refresh`)
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not refresh a funnel from another game', async () => {
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
    const funnelId = createRes.body.funnel.id

    await request(app)
      .delete(`/games/${otherGame.id}/event-funnels/${funnelId}/refresh`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404)
  })
})
