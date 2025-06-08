import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import GameStatFactory from '../../fixtures/GameStatFactory'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { IntegrationType } from '../../../src/entities/integration'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'

describe('Game stat service - updatePlayerStat', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  afterAll(async () => {
    axiosMock.reset()
  })

  it.each(userPermissionProvider([UserType.ADMIN]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: null,
      maxValue: null
    })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()

    await em.persistAndFlush([stat, player, playerStat])

    const res = await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: 20 })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_STAT_UPDATED,
      extra: {
        statInternalName: stat.internalName,
        display: {
          'Player': player.id,
          'Stat': stat.internalName,
          'Old value': 10,
          'New value': 20
        }
      }
    })

    if (statusCode === 200) {
      expect(res.body.playerStat.value).toBe(20)
      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should update global value for global stats', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: 0,
      maxValue: 500,
      global: true,
      globalValue: 100
    })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()

    await em.persistAndFlush([stat, player, playerStat])

    await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: 20 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(stat)
    expect(stat.globalValue).toBe(110) // 100 + (20 - 10)
  })

  it('should not update a player stat if it would go below the minValue', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: 0
    })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()

    await em.persistAndFlush([stat, player, playerStat])

    const res = await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: -5 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Stat would go below the minValue of 0'
    })
  })

  it('should not update a player stat if it would go above the maxValue', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      maxValue: 100
    })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 90 })).one()

    await em.persistAndFlush([stat, player, playerStat])

    const res = await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: 150 })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Stat would go above the maxValue of 100'
    })
  })

  it('should update a player stat if the new value is within min/max constraints', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({
      minValue: 0,
      maxValue: 100
    })).one()
    const player = await new PlayerFactory([game]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 50 })).one()

    await em.persistAndFlush([stat, player, playerStat])

    await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: 75 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(playerStat)
    expect(playerStat.value).toBe(75)
  })

  it('should trigger a steamworks integration event', async () => {
    const setMock = vi.fn(() => [200, {
      result: {
        result: 1
      }
    }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1').replyOnce(setMock)

    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).state(() => ({ maxChange: 99, maxValue: 3000 })).one()
    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 90 })).one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncStats: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await em.persistAndFlush([integration, stat, player])

    await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: 20 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(setMock).toHaveBeenCalledTimes(1)

    const event = await em.getRepository(SteamworksIntegrationEvent).findOneOrFail({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamUserStats/SetUserStatsForGame/v1',
      body: `appid=${config.appId}&steamid=${player.aliases[0].identifier}&count=1&name%5B0%5D=${stat.internalName}&value%5B0%5D=20`,
      method: 'POST'
    })
  })

  it('should not update stats for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const stat = await new GameStatFactory([otherGame]).one()
    const player = await new PlayerFactory([otherGame]).one()
    const playerStat = await new PlayerGameStatFactory().construct(player, stat).state(() => ({ value: 10 })).one()

    await em.persistAndFlush([stat, player, playerStat])

    await request(app)
      .patch(`/games/${otherGame.id}/game-stats/${stat.id}/player-stats/${playerStat.id}`)
      .send({ newValue: 20 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not update a player stat if it does not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).one()
    const player = await new PlayerFactory([game]).one()

    await em.persistAndFlush([stat, player])

    const res = await request(app)
      .patch(`/games/${game.id}/game-stats/${stat.id}/player-stats/999999`)
      .send({ newValue: 20 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player stat not found'
    })
  })

  it('should not update a player stat if the stat does not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const stat = await new GameStatFactory([game]).one()
    const player = await new PlayerFactory([game]).one()

    await em.persistAndFlush([stat, player])

    const res = await request(app)
      .patch(`/games/${game.id}/game-stats/999/player-stats/999999`)
      .send({ newValue: 20 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Stat not found'
    })
  })
})
