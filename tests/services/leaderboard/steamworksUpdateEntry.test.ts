import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../src/entities/integration'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import SteamworksLeaderboardMapping from '../../../src/entities/steamworks-leaderboard-mapping'
import casual from 'casual'

describe('Leaderboard service - update entry - steamworks integration', () => {
  let app: Koa
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    axiosMock.reset()
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should delete entries when they are hidden', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const updateMock = jest.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)

    const player = await new PlayerFactory([game]).state('with steam alias').one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, entry, mapping])

    await request(app.callback())
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}`,
      method: 'POST'
    })
  })

  it('should create entries when they are unhidden', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const updateMock = jest.fn(() => [200, {
      result: {
        result: 1,
        leaderboard_entry_count: 1,
        score_changed: true,
        global_rank_previous: 0,
        global_rank_new: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)

    const player = await new PlayerFactory([game]).state('with steam alias').one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({ hidden: true })).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, entry, mapping])

    await request(app.callback())
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}&score=${entry.score}&scoremethod=KeepBest`,
      method: 'POST'
    })
  })

  it('should not sync entries when syncing is disabled', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const updateMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)

    const player = await new PlayerFactory([game]).state('with steam alias').one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({ hidden: casual.boolean })).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, entry, mapping])

    await request(app.callback())
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: !entry.hidden })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('should not sync entries when the entry is not a steam alias', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const updateMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(casual.integer(100000, 999999), leaderboard)

    const player = await new PlayerFactory([game]).state('with username alias').one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({ hidden: casual.boolean })).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, entry, mapping])

    await request(app.callback())
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: !entry.hidden })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('should not sync entries when there is no leaderboard mapping', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const updateMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const player = await new PlayerFactory([game]).state('with steam alias').one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).with(() => ({ hidden: casual.boolean })).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, entry])

    await request(app.callback())
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: !entry.hidden })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).not.toHaveBeenCalled()
  })
})