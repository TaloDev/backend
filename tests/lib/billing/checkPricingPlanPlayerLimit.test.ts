import { randText } from '@ngneat/falso'
import request from 'supertest'
import PlanUsageWarning from '../../../src/emails/plan-usage-warning-mail'
import { APIKeyScope } from '../../../src/entities/api-key'
import * as sendEmail from '../../../src/lib/messaging/sendEmail'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../utils/createAPIKeyAndToken'

describe('checkPricingPlanPlayerLimit', () => {
  const sendMock = vi.spyOn(sendEmail, 'default')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should allow creation when under the limit', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([apiKey.game]).many(10)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should throw a 402 when subscription status is not active', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.status = 'incomplete'
    await em.flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(402)

    expect(res.body).toStrictEqual({
      message: 'Your subscription is in an incomplete state. Please update your billing details.',
    })
  })

  it('should throw a 402 when going over 105% of the player limit', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 20
    apiKey.game.organisation.pricingPlan.status = 'active'

    // 21 players with limit of 20 = 105%, next player would be 110%
    const players = await new PlayerFactory([apiKey.game]).many(21)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(402)

    expect(res.body).toStrictEqual({
      message: 'Limit reached',
    })
  })

  it('should send an email at 75% usage', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([apiKey.game]).many(74)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(
      new PlanUsageWarning(apiKey.game.organisation, 75, 100).getConfig(),
    )
  })

  it('should send an email at 90% usage', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([apiKey.game]).many(89)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(
      new PlanUsageWarning(apiKey.game.organisation, 90, 100).getConfig(),
    )
  })

  it('should send an email at 100% usage', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([apiKey.game]).many(99)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(
      new PlanUsageWarning(apiKey.game.organisation, 100, 100).getConfig(),
    )
  })

  it('should not send an email below 75% usage', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'

    const randomPlayerCount = Math.floor(Math.random() * 74) + 1
    const players = await new PlayerFactory([apiKey.game]).many(randomPlayerCount - 1)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should allow player creation when playerLimit is null', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = null
    apiKey.game.organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([apiKey.game]).many(100)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).not.toHaveBeenCalled()
  })
})
