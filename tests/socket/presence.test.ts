import { APIKeyScope } from '../../src/entities/api-key'
import GameChannelFactory from '../fixtures/GameChannelFactory'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import createTestSocket from '../utils/createTestSocket'

describe('Socket presence', () => {
  it('should set the player presence to online when identifying', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      await em.refresh(player)
      expect(player.presence!.online).toBe(true)
      expect(player.presence!.playerAlias.id).toBe(player.aliases[0].id)
    })
  })

  it('should set the player presence to offline when socket disconnects', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })

      await em.refresh(player)
      expect(player.presence!.online).toBe(true)
    })

    await em.refresh(player)
    expect(player.presence!.online).toBe(false)
    expect(player.presence!.playerAlias.id).toBe(player.aliases[0].id)
  })

  it('should remove player from temporary channels when going offline', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    const channel = await new GameChannelFactory(player.game).temporaryMembership().one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })
    })

    const refreshedChannel = await em.refreshOrFail(channel, { populate: ['members'] })
    expect(refreshedChannel.members.contains(player.aliases[0])).toBe(false)
  })

  it('should run auto-cleanup on temporary membership channels', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    const channel = await new GameChannelFactory(player.game)
      .temporaryMembership()
      .state(() => ({ autoCleanup: true }))
      .one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
      })
    })

    const refreshedChannel = await em.refresh(channel)
    expect(refreshedChannel).toBeNull()
  })
})
