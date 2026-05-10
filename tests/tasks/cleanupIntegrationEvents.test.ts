import GameCenterIntegrationEvent from '../../src/entities/game-center-integration-event.js'
import GooglePlayGamesIntegrationEvent from '../../src/entities/google-play-games-integration-event.js'
import { IntegrationType } from '../../src/entities/integration.js'
import SteamworksIntegrationEvent from '../../src/entities/steamworks-integration-event.js'
import { cleanupIntegrationEvents } from '../../src/tasks/cleanupIntegrationEvents.js'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../fixtures/IntegrationFactory.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'

describe('cleanupIntegrationEvents', () => {
  it('should delete steamworks integration events older than 6 months', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const oldEvent = new SteamworksIntegrationEvent(integration)
    oldEvent.request = { url: 'https://example.com', method: 'GET', body: '' }
    oldEvent.response = { status: 200, body: {}, timeTaken: 10 }
    oldEvent.createdAt = new Date('2020-01-01')

    const recentEvent = new SteamworksIntegrationEvent(integration)
    recentEvent.request = { url: 'https://example.com', method: 'GET', body: '' }
    recentEvent.response = { status: 200, body: {}, timeTaken: 10 }

    await em.persist([integration, oldEvent, recentEvent]).flush()

    await cleanupIntegrationEvents()

    const remaining = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(remaining).toBe(1)
  })

  it('should delete google play games integration events older than 6 months', async () => {
    const [, game] = await createOrganisationAndGame()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.GOOGLE_PLAY_GAMES, game, {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      })
      .one()

    const oldEvent = new GooglePlayGamesIntegrationEvent(integration)
    oldEvent.request = { url: 'https://example.com', method: 'GET', body: '' }
    oldEvent.response = { status: 200, body: {}, timeTaken: 10 }
    oldEvent.createdAt = new Date('2020-01-01')

    const recentEvent = new GooglePlayGamesIntegrationEvent(integration)
    recentEvent.request = { url: 'https://example.com', method: 'GET', body: '' }
    recentEvent.response = { status: 200, body: {}, timeTaken: 10 }

    await em.persist([integration, oldEvent, recentEvent]).flush()

    await cleanupIntegrationEvents()

    const remaining = await em.repo(GooglePlayGamesIntegrationEvent).count({ integration })
    expect(remaining).toBe(1)
  })

  it('should delete game center integration events older than 6 months', async () => {
    const [, game] = await createOrganisationAndGame()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.GAME_CENTER, game, {
        bundleId: 'com.example.game',
      })
      .one()

    const oldEvent = new GameCenterIntegrationEvent(integration)
    oldEvent.request = { url: 'https://example.com', method: 'GET' }
    oldEvent.response = { status: 200, body: {}, timeTaken: 10 }
    oldEvent.createdAt = new Date('2020-01-01')

    const recentEvent = new GameCenterIntegrationEvent(integration)
    recentEvent.request = { url: 'https://example.com', method: 'GET' }
    recentEvent.response = { status: 200, body: {}, timeTaken: 10 }

    await em.persist([integration, oldEvent, recentEvent]).flush()

    await cleanupIntegrationEvents()

    const remaining = await em.repo(GameCenterIntegrationEvent).count({ integration })
    expect(remaining).toBe(1)
  })

  it('should not delete recent integration events', async () => {
    const [, game] = await createOrganisationAndGame()
    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const event = new SteamworksIntegrationEvent(integration)
    event.request = { url: 'https://example.com', method: 'GET', body: '' }
    event.response = { status: 200, body: {}, timeTaken: 10 }

    await em.persist([integration, event]).flush()

    await cleanupIntegrationEvents()

    const remaining = await em.repo(SteamworksIntegrationEvent).count({ integration })
    expect(remaining).toBe(1)
  })
})
