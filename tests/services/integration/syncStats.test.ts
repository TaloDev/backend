import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { IntegrationType } from '../../../src/entities/integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import clearEntities from '../../utils/clearEntities'
import * as steamworksIntegration from '../../../src/lib/integrations/steamworks-integration'

describe('Integration service - sync stats', () => {
  let app: Koa
  const syncMock = jest.spyOn(steamworksIntegration, 'syncSteamworksStats').mockImplementation()

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['GameActivity'])
    syncMock.mockReset()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    const res = await request(app.callback())
      .post(`/games/${game.id}/integrations/${integration.id}/sync-stats`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED
    })

    if (statusCode === 204) {
      expect(syncMock).toHaveBeenCalledTimes(1)

      expect(activity).not.toBeNull()
    } else {
      expect(syncMock).toHaveBeenCalledTimes(0)

      expect(res.body).toStrictEqual({ message: 'You do not have permissions to sync stats' })

      expect(activity).toBeNull()
    }
  })

  it('should not sync steamworks stats for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    const res = await request(app.callback())
      .post(`/games/${game.id}/integrations/${integration.id}/sync-stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED
    })

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    expect(activity).toBeNull()
  })

  it('should not sync steamworks stats if the config option isnt enabled', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    const res = await request(app.callback())
      .post(`/games/${game.id}/integrations/${integration.id}/sync-stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED
    })

    expect(res.body).toStrictEqual({ message: 'Stat syncing is not enabled' })

    expect(activity).toBeNull()
  })

  it('should not sync steamworks stats for an integration that does not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().with(() => ({ syncStats: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush(integration)

    const res = await request(app.callback())
      .post(`/games/${game.id}/integrations/64/sync-stats`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED
    })

    expect(res.body).toStrictEqual({ message: 'Integration not found' })

    expect(activity).toBeNull()
  })
})
