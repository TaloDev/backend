import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import { IntegrationType } from '../../../src/entities/integration'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import SteamworksIntegrationEvent from '../../../src/entities/steamworks-integration-event'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import { UserType } from '../../../src/entities/user'

describe('Leaderboard service - delete - steamworks integration', () => {
  let app: Koa
  const axiosMock = new AxiosMockAdapter(axios)

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    axiosMock.reset()
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should delete a leaderboard in steamworks', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const deleteMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard])

    await request(app.callback())
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).toHaveBeenCalledTimes(1)

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event.request).toStrictEqual({
      url: 'https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1',
      body: `appid=${config.appId}&name=${leaderboard.internalName}`,
      method: 'POST'
    })
  })

  it('should not delete a leaderboard in steamworks if syncLeaderboards is false', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const deleteMock = jest.fn(() => [200, {}])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboard/v1').replyOnce(deleteMock)

    const leaderboard = await new LeaderboardFactory([game]).one()

    const config = await new IntegrationConfigFactory().with(() => ({ syncLeaderboards: false })).one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>app.context.em).persistAndFlush([integration, leaderboard])

    await request(app.callback())
      .delete(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(deleteMock).not.toHaveBeenCalled()

    const event = await (<EntityManager>app.context.em).getRepository(SteamworksIntegrationEvent).findOne({ integration })
    expect(event).toBeNull()

    axiosMock.reset()
  })
})
