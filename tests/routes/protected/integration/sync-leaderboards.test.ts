import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import { IntegrationType } from '../../../../src/entities/integration'
import { UserType } from '../../../../src/entities/user'
import * as steamworksIntegration from '../../../../src/lib/integrations/steamworks-integration'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../../fixtures/IntegrationFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Integration - sync leaderboards', () => {
  const syncMock = vi
    .spyOn(steamworksIntegration, 'syncSteamworksLeaderboards')
    .mockImplementation(Promise.resolve)

  beforeEach(async () => {
    syncMock.mockReset()
  })

  it.each(userPermissionProvider([UserType.ADMIN], 204))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const config = await new IntegrationConfigFactory()
        .state(() => ({ syncLeaderboards: true }))
        .one()
      const integration = await new IntegrationFactory()
        .construct(IntegrationType.STEAMWORKS, game, config)
        .one()
      await em.persistAndFlush(integration)

      const res = await request(app)
        .post(`/games/${game.id}/integrations/${integration.id}/sync-leaderboards`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const activity = await em.getRepository(GameActivity).findOne({
        type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED,
        game,
      })

      if (statusCode === 204) {
        expect(syncMock).toHaveBeenCalledTimes(1)

        expect(activity).not.toBeNull()
      } else {
        expect(syncMock).toHaveBeenCalledTimes(0)

        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to sync leaderboards',
        })

        expect(activity).toBeNull()
      }
    },
  )

  it('should not sync steamworks leaderboards for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory()
      .state(() => ({ syncLeaderboards: true }))
      .one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persistAndFlush(integration)

    const res = await request(app)
      .post(`/games/${game.id}/integrations/${integration.id}/sync-leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    expect(activity).toBeNull()
  })

  it('should not sync steamworks leaderboards if the config option isnt enabled', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory()
      .state(() => ({ syncLeaderboards: false }))
      .one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persistAndFlush(integration)

    const res = await request(app)
      .post(`/games/${game.id}/integrations/${integration.id}/sync-leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(400)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Leaderboard syncing is not enabled' })

    expect(activity).toBeNull()
  })

  it('should not sync steamworks leaderboards for an integration that does not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory()
      .state(() => ({ syncLeaderboards: false }))
      .one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .post(`/games/${game.id}/integrations/${Number.MAX_SAFE_INTEGER}/sync-leaderboards`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Integration not found' })

    expect(activity).toBeNull()
  })
})
