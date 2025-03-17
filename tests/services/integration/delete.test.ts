import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { IntegrationType } from '../../../src/entities/integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Integration service - delete', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>global.em).persistAndFlush(integration)

    const res = await request(global.app)
      .delete(`/games/${game.id}/integrations/${integration.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      game
    })

    if (statusCode === 204) {
      expect(activity!.extra.integrationType).toBe(IntegrationType.STEAMWORKS)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete integrations' })

      expect(activity).toBeNull()
    }
  })

  it('should not delete an integration for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>global.em).persistAndFlush(integration)

    const res = await request(global.app)
      .delete(`/games/${game.id}/integrations/${integration.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      game
    })

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    expect(activity).toBeNull()
  })

  it('should not delete an integration that does not exist', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integration = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).one()
    await (<EntityManager>global.em).persistAndFlush(integration)

    const res = await request(global.app)
      .delete(`/games/${game.id}/integrations/433`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      game
    })

    expect(res.body).toStrictEqual({ message: 'Integration not found' })

    expect(activity).toBeNull()
  })
})
