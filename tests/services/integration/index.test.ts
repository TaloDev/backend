import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { IntegrationType } from '../../../src/entities/integration'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory'
import IntegrationFactory from '../../fixtures/IntegrationFactory'

describe('Integration service - index', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const config = await new IntegrationConfigFactory().one()
    const integrations = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).many(3)
    await global.em.persistAndFlush(integrations)

    const res = await request(global.app)
      .get(`/games/${game.id}/integrations`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.integrations).toHaveLength(integrations.length)
      for (const integration of res.body.integrations) {
        expect(integration.config.appId).toBeDefined()
        expect(integration.config.apiKey).not.toBeDefined()
      }
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view integrations' })
    }
  })

  it('should not return integrations for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integrations = await new IntegrationFactory().construct(IntegrationType.STEAMWORKS, game, config).many(3)
    await global.em.persistAndFlush(integrations)

    const res = await request(global.app)
      .get(`/games/${game.id}/integrations`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
