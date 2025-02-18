import { APIKeyScope } from '../../src/entities/api-key'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import { EntityManager } from '@mikro-orm/mysql'
import createTestSocket from '../utils/createTestSocket'

describe('Socket presence', () => {
  it('should set the player presence to online when identifying', async () => {
    const em: EntityManager = global.em
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      // Refresh the player entity to get the latest presence
      await em.refresh(player, { populate: ['presence'] })
      expect(player.presence.online).toBe(true)
      expect(player.presence.playerAlias.id).toBe(player.aliases[0].id)
    })
  })

  it('should set the player presence to offline when socket disconnects', async () => {
    const em: EntityManager = global.em
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      await em.refresh(player, { populate: ['presence'] })
      expect(player.presence.online).toBe(true)
    })

    await em.refresh(player, { populate: ['presence'] })
    expect(player.presence.online).toBe(false)
    expect(player.presence.playerAlias.id).toBe(player.aliases[0].id)
  })
})
