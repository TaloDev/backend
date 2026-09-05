import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Event funnels - create', () => {
  it('should create a funnel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Onboarding',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.funnel).toMatchObject({
      name: 'Onboarding',
      maxGap: 60,
    })
    expect(res.body.funnel.steps).toEqual([
      { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
      { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
    ])
  })

  it('should reject duplicate step names', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body.errors.steps[0]).toBe('Step names must be distinct')
  })

  it('should reject a between rule with a single value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          {
            name: 'Shop Opened',
            props: {
              ruleMode: 'and',
              rules: [{ key: 'amount', op: 'between', value: ['10'] }],
            },
          },
          { name: 'Purchase Completed', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should reject a funnel with a single step', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [{ name: 'Game Started', props: { ruleMode: 'and', rules: [] } }],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should reject a non-positive max gap', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await request(app)
      .post(`/games/${game.id}/event-funnels`)
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 0,
      })
      .auth(token, { type: 'bearer' })
      .expect(400)
  })

  it('should not create a funnel for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    await request(app)
      .post('/games/99999/event-funnels')
      .send({
        name: 'Funnel',
        steps: [
          { name: 'Game Started', props: { ruleMode: 'and', rules: [] } },
          { name: 'Chest Looted', props: { ruleMode: 'and', rules: [] } },
        ],
        maxGap: 60,
      })
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should not create a funnel for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(app)
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
      .expect(403)
  })
})
