import PlayerFactory from '../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import PlanUsageWarning from '../../../src/emails/plan-usage-warning-mail'
import SendGrid from '@sendgrid/mail'
import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'

describe('checkPricingPlanPlayerLimit', () => {
  const sendMock = vi.spyOn(SendGrid, 'send')

  afterEach(() => {
    sendMock.mockClear()
  })

  it('should allow creation when under the limit', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.pricingPlan.playerLimit = 100
    organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([game]).many(10)
    await global.em.persistAndFlush(players)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should throw a 402 when subscription status is not active', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.status = 'incomplete'
    await global.em.flush()

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(402)

    expect(res.body).toStrictEqual({
      message: 'Your subscription is in an incomplete state. Please update your billing details.'
    })
  })

  it('should send an email at 75% usage', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.pricingPlan.playerLimit = 100
    organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([game]).many(74)
    await global.em.persistAndFlush(players)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(new PlanUsageWarning(organisation, 75, 100).getConfig())
  })

  it('should send an email at 90% usage', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.pricingPlan.playerLimit = 100
    organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([game]).many(89)
    await global.em.persistAndFlush(players)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(new PlanUsageWarning(organisation, 90, 100).getConfig())
  })

  it('should send an email at 100% usage', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.pricingPlan.playerLimit = 100
    organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([game]).many(99)
    await global.em.persistAndFlush(players)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(sendMock).toHaveBeenCalledWith(new PlanUsageWarning(organisation, 100, 100).getConfig())
  })

  it('should not send an email below 75% usage', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.pricingPlan.playerLimit = 100
    organisation.pricingPlan.status = 'active'

    const randomPlayerCount = Math.floor(Math.random() * 74) + 1
    const players = await new PlayerFactory([game]).many(randomPlayerCount - 1)
    await global.em.persistAndFlush(players)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('should allow player creation when playerLimit is null', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    organisation.pricingPlan.pricingPlan.playerLimit = null
    organisation.pricingPlan.status = 'active'

    const players = await new PlayerFactory([game]).many(100)
    await global.em.persistAndFlush(players)

    const res = await request(global.app)
      .post(`/games/${game.id}/players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player).toBeTruthy()
    expect(sendMock).not.toHaveBeenCalled()
  })
})
