import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'
import Integration, { IntegrationType } from '../../../src/entities/integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Integration service - post', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const config = await new IntegrationConfigFactory().one()

    const res = await request(app)
      .post(`/games/${game.id}/integrations`)
      .send({ type: IntegrationType.STEAMWORKS, config })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_ADDED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.integration.config.appId).toBeDefined()
      expect(res.body.integration.config.apiKey).not.toBeDefined()

      expect(activity!.extra.integrationType).toBe(IntegrationType.STEAMWORKS)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to add integrations' })

      expect(activity).toBe(null)
    }
  })

  it('should encrypt the api key for a steamworks integration', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().one()

    const res = await request(app)
      .post(`/games/${game.id}/integrations`)
      .send({ type: IntegrationType.STEAMWORKS, config })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const integration = await em.getRepository(Integration).findOne(res.body.integration.id)
    // @ts-expect-error accessing private
    expect(integration.config.apiKey).not.toBe(config.apiKey)
    // @ts-expect-error accessing private
    expect(integration.config.apiKey).toContain(':')
  })

  it('should drop any irrelevant config keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().one()

    const res = await request(app)
      .post(`/games/${game.id}/integrations`)
      .send({ type: IntegrationType.STEAMWORKS, config: { ...config, syncCrazyNewSteamworksFeature: true } })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const integration = await em.getRepository(Integration).findOne(res.body.integration.id)
    // @ts-expect-error accessing private
    expect(integration.config.syncCrazyNewSteamworksFeature).not.toBeDefined()
  })

  it('should not add an integration for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()

    await request(app)
      .post(`/games/${game.id}/integrations`)
      .send({ type: IntegrationType.STEAMWORKS, config })
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_ADDED,
      game
    })

    expect(activity).toBe(null)
  })

  it('should not add a duplicate integration for the same type', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().one()
    const integration = new Integration(IntegrationType.STEAMWORKS, game, config)
    await em.persistAndFlush(integration)

    const res = await request(app)
      .post(`/games/${game.id}/integrations`)
      .send({ type: IntegrationType.STEAMWORKS, config })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: `This game already has an integration for ${IntegrationType.STEAMWORKS}` })
  })

  it('should not add an integration with an invalid type', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().one()

    const res = await request(app)
      .post(`/games/${game.id}/integrations`)
      .send({ type: 'invalid', config })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        type: [`Integration type must be one of ${Object.values(IntegrationType).join(', ')}`]
      }
    })
  })
})
