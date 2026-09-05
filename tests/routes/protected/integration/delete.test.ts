import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import Integration, { IntegrationType } from '../../../../src/entities/integration.js'
import SteamworksIntegrationEvent from '../../../../src/entities/steamworks-integration-event.js'
import { SteamworksLeaderboardEntry } from '../../../../src/entities/steamworks-leaderboard-entry.js'
import SteamworksLeaderboardMapping from '../../../../src/entities/steamworks-leaderboard-mapping.js'
import { SteamworksPlayerStat } from '../../../../src/entities/steamworks-player-stat.js'
import { UserType } from '../../../../src/entities/user.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../../../fixtures/IntegrationFactory.js'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Integration - delete', () => {
  it.each(userPermissionProvider([UserType.ADMIN], 204))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const config = await new IntegrationConfigFactory().one()
      const integration = await new IntegrationFactory()
        .construct(IntegrationType.STEAMWORKS, game, config)
        .one()
      await em.persist(integration).flush()

      const event = new SteamworksIntegrationEvent(integration)
      event.request = { url: '', method: 'GET', body: '' }
      event.response = { status: 200, body: {}, timeTaken: 0 }
      await em.persist(event).flush()

      const res = await request(app)
        .delete(`/games/${game.id}/integrations/${integration.id}`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.GAME_INTEGRATION_DELETED,
        game,
      })

      if (statusCode === 204) {
        expect(activity?.extra.integrationType).toBe(IntegrationType.STEAMWORKS)

        expect(await em.refresh(integration)).toBeNull()
        expect(await em.repo(SteamworksIntegrationEvent).count({ integration })).toBe(0)
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to delete integrations',
        })

        expect(activity).toBeNull()
      }
    },
  )

  it('should not delete an integration for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/integrations/${integration.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    expect(activity).toBeNull()
  })

  it('should not delete an integration that does not exist', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()
    await em.persist(integration).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/integrations/433`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      game,
    })

    expect(res.body).toStrictEqual({ message: 'Integration not found' })

    expect(activity).toBeNull()
  })

  it('should delete steamworks entities when deleting an integration', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ unique: false })).one()
    const mapping = new SteamworksLeaderboardMapping({
      steamworksLeaderboardId: 12345,
      leaderboard,
      integration,
    })
    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const steamworksEntry = new SteamworksLeaderboardEntry({
      steamworksLeaderboard: mapping,
      leaderboardEntry: null,
      steamUserId: player.aliases[0].identifier,
    })
    const steamworksPlayerStat = new SteamworksPlayerStat({
      stat: await new GameStatFactory([game]).one(),
      integration,
      playerStat: null,
      steamUserId: player.aliases[0].identifier,
    })

    await em
      .persist([integration, leaderboard, player, mapping, steamworksEntry, steamworksPlayerStat])
      .flush()

    await request(app)
      .delete(`/games/${game.id}/integrations/${integration.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.repo(Integration).count({ game })).toBe(0)
    expect(await em.repo(SteamworksLeaderboardMapping).count({ leaderboard })).toBe(0)
    expect(
      await em.repo(SteamworksLeaderboardEntry).count({ steamworksLeaderboard: { leaderboard } }),
    ).toBe(0)
    expect(await em.repo(SteamworksPlayerStat).count({ stat: steamworksPlayerStat.stat })).toBe(0)
  })
})
