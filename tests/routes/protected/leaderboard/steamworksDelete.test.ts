import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../../src/entities/integration'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import { UserType } from '../../../../src/entities/user'
import SteamworksLeaderboardMapping from '../../../../src/entities/steamworks-leaderboard-mapping'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { SteamworksLeaderboardEntry } from '../../../../src/entities/steamworks-leaderboard-entry'
import LeaderboardEntryFactory from '../../../fixtures/LeaderboardEntryFactory'

describe('Leaderboard  - delete - steamworks integration', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterEach(() => {
    axiosMock.reset()
  })

  it('should delete a leaderboard in steamworks', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const deleteMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, leaderboard])

    await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1',
      body: `appid=${config.appId}&name=${leaderboard.internalName}`,
      method: 'POST'
    })
  })

  it('should not delete a leaderboard in steamworks if syncLeaderboards is false', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const deleteMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, leaderboard])

    await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).not.toHaveBeenCalled()

    const event = await em.getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()
  })

  it('should delete the steamworks leaderboard mapping and steamworks entries', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const deleteMock = vi.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()
    const steamworksLeaderboard = new SteamworksLeaderboardMapping(12345, leaderboard)

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()

    const players = await new PlayerFactory([game]).many(10)
    const entries = await Promise.all(players.map(async (player) => {
      return new SteamworksLeaderboardEntry({
        steamworksLeaderboard,
        leaderboardEntry: await new LeaderboardEntryFactory(leaderboard, [player]).one(),
        steamUserId: player.aliases[0].identifier
      })
    }))

    await em.persistAndFlush([integration, ...entries])

    await request(app)
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1',
      body: `appid=${config.appId}&name=${leaderboard.internalName}`,
      method: 'POST'
    })

    const entryCount = await em.repo(SteamworksLeaderboardEntry).count({
      leaderboardEntry: {
        leaderboard: {
          game
        }
      }
    })
    expect(entryCount).toBe(0)
    expect(await em.refresh(steamworksLeaderboard)).toBeNull()
  })
})
