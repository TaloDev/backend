import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - delete', () => {
  it('should delete a funnel', async () => {
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
      .delete(`/games/${game.id}/event-funnels/${funnelId}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    await request(app)
      .get(`/games/${game.id}/event-funnels/${funnelId}`)
      .query({ startDate: '2026-09-01', endDate: '2026-09-02' })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should return 404 for a non-existent funnel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .delete(`/games/${game.id}/event-funnels/99999`)
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not delete a funnel from another game', async () => {
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
      .delete(`/games/${otherGame.id}/event-funnels/${funnelId}`)
      .auth(otherToken, { type: 'bearer' })
      .expect(404)
  })
})
