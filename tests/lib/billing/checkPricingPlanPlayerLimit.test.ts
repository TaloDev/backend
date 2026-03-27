import { randText } from '@ngneat/falso'
import request from 'supertest'
import PlanUsageWarning from '../../../src/emails/plan-usage-warning-mail'
import { APIKeyScope } from '../../../src/entities/api-key'
import { getUsageBucket } from '../../../src/lib/billing/checkPricingPlanPlayerLimit'
import * as sendEmail from '../../../src/lib/messaging/sendEmail'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createAPIKeyAndToken from '../../utils/createAPIKeyAndToken'

describe('getUsageBucket', () => {
  it.each([
    [0, null],
    [74.9, null],
    [75, 75],
    [76, 75],
    [89.9, 75],
    [90, 90],
    [99.9, 90],
    [100, 100],
    [100.9, 100],
    [101, 101],
    [101.9, 101],
    [102, 102],
    [104.9, 104],
  ])('returns %s as bucket %s', (percentage, expected) => {
    expect(getUsageBucket(percentage)).toBe(expected)
  })
})

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
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBe(75)
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
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBe(90)
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
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBe(100)
  })

  it('should send an email when usage crosses 75% without hitting it exactly', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    // limit of 300: 225 = 75% exactly, but 226 = 75.33% — the old code would miss this
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 300
    apiKey.game.organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([apiKey.game]).many(225)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(
      new PlanUsageWarning(apiKey.game.organisation, 226, 300).getConfig(),
    )
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBe(75)
  })

  it('should not send a duplicate email when called again at the same bucket', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'
    // pre-set threshold so we're already in the 75 bucket
    apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold = 75
    await em.flush()

    const players = await new PlayerFactory([apiKey.game]).many(76)
    await em.persist(players).flush()

    await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should send a new email when advancing to the next bucket', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'
    // already sent the 75% email
    apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold = 75
    await em.flush()

    // now at 90%
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
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBe(90)
  })

  it('should send emails at each 1% overage bucket', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'
    // already at the 100 bucket
    apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold = 100
    await em.flush()

    // 101 players = 101%
    const players = await new PlayerFactory([apiKey.game]).many(100)
    await em.persist(players).flush()

    const res = await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.alias).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(
      new PlanUsageWarning(apiKey.game.organisation, 101, 100).getConfig(),
    )
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBe(101)
  })

  it('should reset the threshold and re-send when usage drops and rises again', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS,
    ])
    apiKey.game.organisation.pricingPlan.pricingPlan.playerLimit = 100
    apiKey.game.organisation.pricingPlan.status = 'active'
    // simulate having been at 90% previously
    apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold = 90
    await em.flush()

    // now usage is below 75% (e.g., 50 players = 50%), threshold should reset to null
    const players = await new PlayerFactory([apiKey.game]).many(49)
    await em.persist(players).flush()

    await request(app)
      .get('/v1/players/identify')
      .query({ service: 'steam', identifier: randText() })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(sendMock).not.toHaveBeenCalled()
    await em.refresh(apiKey.game.organisation.pricingPlan)
    expect(apiKey.game.organisation.pricingPlan.lastUsageWarningThreshold).toBeNull()
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
