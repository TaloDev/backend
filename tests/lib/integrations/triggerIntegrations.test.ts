import { IntegrationType } from '../../../src/entities/integration.js'
import triggerIntegrations from '../../../src/lib/integrations/triggerIntegrations.js'
import IntegrationConfigFactory from '../../fixtures/IntegrationConfigFactory.js'
import IntegrationFactory from '../../fixtures/IntegrationFactory.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'

describe('triggerIntegrations', () => {
  it('should run every integration even when one throws', async () => {
    const [, game] = await createOrganisationAndGame()

    const first = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, await new IntegrationConfigFactory().one())
      .one()
    const second = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, await new IntegrationConfigFactory().one())
      .one()
    await em.persist([first, second]).flush()

    const calls: number[] = []
    await expect(
      triggerIntegrations(em, game, async (integration) => {
        if (integration.id === first.id) {
          throw new Error('first integration failed')
        }
        calls.push(integration.id)
      }),
    ).resolves.not.toThrow()

    expect(calls).toStrictEqual([second.id])
  })
})
