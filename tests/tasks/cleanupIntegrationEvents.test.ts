import GooglePlayGamesIntegrationEvent from '../../src/entities/google-play-games-integration-event'
import { IntegrationType } from '../../src/entities/integration'
import SteamworksIntegrationEvent from '../../src/entities/steamworks-integration-event'
import { cleanupIntegrationEvents } from '../../src/tasks/cleanupIntegrationEvents'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'

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
