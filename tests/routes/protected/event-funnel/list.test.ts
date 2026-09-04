import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - list', () => {
  it('should list funnels for a game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const create = (name: string) =>
      request(app)
        .post(`/games/${game.id}/event-funnels`)
        .send({
          name,
          steps: [
            { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
            { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
          ],
          maxGap: 60,
        })
        .auth(token, { type: 'bearer' })

    await create('One').expect(200)
    await create('Two').expect(200)

    const res = await request(app)
      .get(`/games/${game.id}/event-funnels`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.funnels).toHaveLength(2)
    expect(res.body.funnels.map((funnel: { name: string }) => funnel.name)).toEqual(
      expect.arrayContaining(['One', 'Two']),
    )
  })

  it('should return an empty list when no funnels exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/event-funnels`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.funnels).toEqual([])
  })

  it('should not list funnels for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
      .get(`/games/${game.id}/event-funnels`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
