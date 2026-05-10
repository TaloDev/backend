import request from 'supertest'
import { IntegrationType } from '../../../../src/entities/integration.js'
import { UserType } from '../../../../src/entities/user.js'
import IntegrationConfigFactory from '../../../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../../../fixtures/IntegrationFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Integration - list', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const config = await new IntegrationConfigFactory().one()
      const integrations = await new IntegrationFactory()
        .construct(IntegrationType.STEAMWORKS, game, config)
        .many(3)
      await em.persist(integrations).flush()

      const res = await request(app)
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
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to view integrations',
        })
      }
    },
  )

  it('should not return integrations for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const config = await new IntegrationConfigFactory().one()
    const integrations = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .many(3)
    await em.persist(integrations).flush()

    const res = await request(app)
      .get(`/games/${game.id}/integrations`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
