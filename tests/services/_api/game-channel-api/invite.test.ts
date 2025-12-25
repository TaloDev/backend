import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'
import assert from 'node:assert'

describe('Game channel API service - invite', () => {
  it('should invite a player to a channel if the inviter is the owner', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const owner = await new PlayerFactory([apiKey.game]).one()
    const invitee = await new PlayerFactory([apiKey.game]).one()

    assert(owner.aliases[0])
    assert(invitee.aliases[0])

    channel.owner = owner.aliases[0]
    await em.persistAndFlush([channel, owner, invitee])

    await request(app)
      .post(`/v1/game-channels/${channel.id}/invite`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(owner.aliases[0].id))
      .send({ inviteeAliasId: invitee.aliases[0].id })
      .expect(204)
  })

  it('should not invite a player if the inviter is not the owner', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const nonOwner = await new PlayerFactory([apiKey.game]).one()
    const invitee = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, nonOwner, invitee])

    assert(nonOwner.aliases[0])
    assert(invitee.aliases[0])

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/invite`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(nonOwner.aliases[0].id))
      .send({ inviteeAliasId: invitee.aliases[0].id })
      .expect(403)

    expect(res.body).toStrictEqual({
      message: 'This player is not the owner of the channel'
    })
  })

  it('should not invite if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const owner = await new PlayerFactory([apiKey.game]).one()
    const invitee = await new PlayerFactory([apiKey.game]).one()

    assert(owner.aliases[0])
    assert(invitee.aliases[0])

    channel.owner = owner.aliases[0]
    await em.persistAndFlush([channel, owner, invitee])

    await request(app)
      .post(`/v1/game-channels/${channel.id}/invite`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(owner.aliases[0].id))
      .send({ inviteeAliasId: invitee.aliases[0].id })
      .expect(403)
  })

  it('should not create an invite with an invalid alias', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persistAndFlush(channel)

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/invite`)
      .send({ inviteeAliasId: 32144 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found'
    })
  })

  it('should not create an invite for a channel that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, player])

    const alias = player.aliases[0]
    assert(alias)

    const res = await request(app)
      .post('/v1/game-channels/54252/invite')
      .send({ inviteeAliasId: 32144 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(alias.id))
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Channel not found'
    })
  })

  it('should not invite a player that does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const owner = await new PlayerFactory([apiKey.game]).one()

    assert(owner.aliases[0])
    channel.owner = owner.aliases[0]
    await em.persistAndFlush([channel, owner])

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/invite`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(owner.aliases[0].id))
      .send({ inviteeAliasId: 99999 })
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Invitee not found'
    })
  })

  it('should not allow self-invites', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const owner = await new PlayerFactory([apiKey.game]).one()

    assert(owner.aliases[0])
    channel.owner = owner.aliases[0]
    await em.persistAndFlush([channel, owner])

    const res = await request(app)
      .post(`/v1/game-channels/${channel.id}/invite`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(owner.aliases[0].id))
      .send({ inviteeAliasId: owner.aliases[0].id })
      .expect(400)

    expect(res.body).toStrictEqual({
      message: 'Players cannot invite themselves'
    })
  })

  it('should notify players in the channel when a new player is invited', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CHANNELS,
      APIKeyScope.WRITE_GAME_CHANNELS
    ])

    const channel = await new GameChannelFactory(player.game).one()

    const alias = player.aliases[0]
    assert(alias)
    channel.owner = alias
    channel.members.add(alias)

    const invitee = await new PlayerFactory([player.game]).one()
    const inviteeAlias = invitee.aliases[0]
    assert(inviteeAlias)

    await em.persistAndFlush([channel, player, invitee])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .post(`/v1/game-channels/${channel.id}/invite`)
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(alias.id))
        .send({ inviteeAliasId: inviteeAlias.id })
        .expect(204)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.channels.player-joined')
        expect(actual.data.channel.id).toBe(channel.id)
        expect(actual.data.playerAlias.id).toBe(inviteeAlias.id)
      })
    })
  })
})
