import assert from 'node:assert'
import { APIKeyScope } from '../../src/entities/api-key'
import GameChannel from '../../src/entities/game-channel'
import GameChannelFactory from '../fixtures/GameChannelFactory'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage'
import createTestSocket from '../utils/createTestSocket'

describe('Socket presence', () => {
  it('should set the player presence to online when identifying', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)

      const updatedPlayer = await em.refresh(player, { populate: ['presence'] })
      assert(updatedPlayer)
      assert(updatedPlayer.presence)

      expect(updatedPlayer.presence.online).toBe(true)
      expect(updatedPlayer.presence.playerAlias.id).toBe(player.aliases[0].id)
    })
  })

  it('should set the player presence to offline when socket disconnects', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)

      const updatedPlayer = await em.refreshOrFail(player, { populate: ['presence'] })
      assert(updatedPlayer.presence)
      expect(updatedPlayer.presence.online).toBe(true)
    })

    await em.refresh(player)
    expect(player.presence!.online).toBe(false)
    expect(player.presence!.playerAlias.id).toBe(player.aliases[0].id)
  })

  it('should remove player from temporary channels when going offline', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    const channel = await new GameChannelFactory(player.game).temporaryMembership().one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
    })

    const refreshedChannel = await em.refreshOrFail(channel, { populate: ['members'] })
    expect(refreshedChannel.members.contains(player.aliases[0])).toBe(false)
  })

  it('should run auto-cleanup on temporary membership channels', async () => {
    const sendMessageToMembersMock = vi.spyOn(GameChannel.prototype, 'sendMessageToMembers')

    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    const channel = await new GameChannelFactory(player.game)
      .temporaryMembership()
      .state(() => ({ autoCleanup: true }))
      .one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
    })

    const refreshedChannel = await em.refresh(channel)
    expect(refreshedChannel).toBeNull()

    expect(sendMessageToMembersMock).toHaveBeenCalledOnce()
    const lastCall = sendMessageToMembersMock.mock.lastCall
    assert(lastCall)

    const [, res, data] = lastCall
    expect(res).toBe('v1.channels.deleted')
    assert('channel' in data)
    expect((data.channel as GameChannel).id).toBe(channel.id)
  })
})
