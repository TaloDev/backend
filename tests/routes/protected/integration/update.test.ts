import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import { IntegrationType } from '../../../../src/entities/integration'
import { UserType } from '../../../../src/entities/user'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Integration - update', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const config = await new IntegrationConfigFactory().one()
      const integration = await new IntegrationFactory()
        .construct(IntegrationType.STEAMWORKS, game, config)
        .one()
      await em.persist(integration).flush()

      const res = await request(app)
        .patch(`/games/${game.id}/integrations/${integration.id}`)
        .send({ config: { appId: 377999 } })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const activity = await em.getRepository(GameActivity).findOne({
        type: GameActivityType.GAME_INTEGRATION_UPDATED,
        game,
      })

      if (statusCode === 200) {
        expect(res.body.integration.config.appId).toBe(377999)

        expect(activity!.extra.integrationType).toBe(IntegrationType.STEAMWORKS)

        expect(activity!.extra.display).toStrictEqual({
          'Updated properties': 'appId',
        })
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to update integrations',
        })

        expect(activity).toBeNull()
      }
    },
  )

  it('should update the api key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const oldApiKey = integration.getSteamAPIKey()

    await request(app)
      .patch(`/games/${game.id}/integrations/${integration.id}`)
      .send({ config: { apiKey: '37d3858156974d7198af061f394a7fc8' } })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(integration)
    expect(integration.getSteamAPIKey()).not.toBe(oldApiKey)
  })

  it('should not update an integration for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/integrations/${integration.id}`)
      .send({ config: { appId: 377999 } })
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_UPDATED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    expect(activity).toBeNull()
  })

  it('should update the google play games clientId', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const integration = await new IntegrationFactory()
      .construct(IntegrationType.GOOGLE_PLAY_GAMES, game, {
        clientId: 'old-client-id',
        clientSecret: 'old-client-secret',
      })
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/integrations/${integration.id}`)
      .send({ config: { clientId: 'new-client-id' } })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.integration.config.clientId).toBe('new-client-id')

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_UPDATED,
      game,
    })
    expect(activity!.extra.integrationType).toBe(IntegrationType.GOOGLE_PLAY_GAMES)
    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'clientId',
    })
  })

  it('should update the google play games clientSecret', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const integration = await new IntegrationFactory()
      .construct(IntegrationType.GOOGLE_PLAY_GAMES, game, {
        clientId: 'test-client-id',
        clientSecret: 'old-client-secret',
      })
      .one()
    await em.persist(integration).flush()

    const oldClientSecret = integration.getGooglePlayGamesClientSecret()

    await request(app)
      .patch(`/games/${game.id}/integrations/${integration.id}`)
      .send({ config: { clientSecret: 'new-client-secret' } })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(integration)
    expect(integration.getGooglePlayGamesClientSecret()).not.toBe(oldClientSecret)
    expect(integration.getGooglePlayGamesClientSecret()).toBe('new-client-secret')
  })

  it('should not update an integration that does not exist', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/integrations/1243`)
      .send({ config: { appId: 377999 } })
      .auth(token, { type: 'bearer' })
      .expect(404)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_UPDATED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Integration not found' })

    expect(activity).toBeNull()
  })
})
