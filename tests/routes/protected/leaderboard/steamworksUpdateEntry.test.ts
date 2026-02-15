import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../../src/entities/integration'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import SteamworksLeaderboardMapping from '../../../../src/entities/steamworks-leaderboard-mapping'
import { randBoolean, randNumber } from '@ngneat/falso'
import { UserType } from '../../../../src/entities/user'
import { SteamworksLeaderboardEntry } from '../../../../src/entities/steamworks-leaderboard-entry'

describe('Leaderboard - update entry - steamworks integration', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(async () => {
    axiosMock.reset()
  })

  it('should delete entries when they are hidden', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const updateMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).one()
    const steamworksEntry = new SteamworksLeaderboardEntry({
      steamworksLeaderboard: mapping,
      leaderboardEntry: entry,
      steamUserId: player.aliases[0].identifier
    })

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, steamworksEntry])

    await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}`,
      method: 'POST'
    })

    expect(await em.refresh(steamworksEntry)).toBeNull()
  })

  it('should create entries when they are unhidden', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const updateMock = vi.fn(() => [200, {
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
    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ hidden: true })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, entry, mapping])

    await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}&score=${entry.score}&scoremethod=KeepBest`,
      method: 'POST'
    })
  })

  it('should not sync entries when syncing is disabled', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const updateMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ hidden: randBoolean() })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, entry, mapping])

    await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: !entry.hidden })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('should not sync entries when the entry is not a steam alias', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const updateMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)

    const player = await new PlayerFactory([game]).withUsernameAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ hidden: randBoolean() })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, entry, mapping])

    await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: !entry.hidden })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('should not sync entries when there is no leaderboard mapping', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const updateMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ hidden: randBoolean() })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, entry])

    await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: !entry.hidden })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('should update entries when their score is changed', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const updateMock = vi.fn(() => [200, {
      result: {
        result: 1,
        leaderboard_entry_count: 1,
        score_changed: true,
        global_rank_previous: 1,
        global_rank_new: 2
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1').replyOnce(updateMock)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player]).state(() => ({ score: 100 })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, entry, mapping])

    await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ newScore: 200 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(updateMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/SetLeaderboardScore/v1',
      body: `appid=${config.appId}&leaderboardid=${mapping.steamworksLeaderboardId}&steamid=${player.aliases[0].identifier}&score=200&scoremethod=KeepBest`,
      method: 'POST'
    })
  })
})
