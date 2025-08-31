import request from 'supertest'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import { Collection } from '@mikro-orm/core'
import PlayerProp from '../../../../src/entities/player-prop'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import PlayerGroupRule, { PlayerGroupRuleCastType, PlayerGroupRuleName } from '../../../../src/entities/player-group-rule'

describe('Game channel API service - members', () => {
  it('should return channel members if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)

    expect(res.body).toStrictEqual(expect.objectContaining({
      count: 1,
      itemsPerPage: 50,
      isLastPage: true
    }))
  })

  it('should not return channel members if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)
  })

  it('should return 404 if the channel does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])
    const player = await new PlayerFactory([apiKey.game]).one()

    const res = await request(app)
      .get('/v1/game-channels/999999/members')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Channel not found' })
  })

  it('should not return dev build players without the dev data header, unless its the current player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).devBuild().one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([channel, player, otherPlayer])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
  })

  it('should return dev build players with the dev data header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).devBuild().one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
  })

  it('should return 404 if the player does not exist', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '99999')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not return members if the player is not in the channel', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    await em.persistAndFlush([channel, player])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'This player is not a member of the channel' })
  })

  it('should paginate channel members', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.set([
      player.aliases[0],
      ...(await new PlayerAliasFactory(player).many(100))
    ])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 1 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(50)
    expect(res.body).toStrictEqual(expect.objectContaining({
      count: 101,
      itemsPerPage: 50,
      isLastPage: false
    }))
  })

  it('should set the page to 0 if one is not provided', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const channel = await new GameChannelFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()
    channel.members.add(player.aliases[0])
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body).toStrictEqual(expect.objectContaining({
      count: 1,
      itemsPerPage: 50,
      isLastPage: true
    }))
  })

  it('should filter by alias ids', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([channel, player, otherPlayer])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0, aliasId: String(player.aliases[0].id) })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should filter by alias identifiers', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([channel, player, otherPlayer])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0, identifier: player.aliases[0].identifier })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should filter by player ids', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([channel, player, otherPlayer])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0, playerId: player.id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should filter by player prop keys', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '8')
      ])
    })).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([channel, player, otherPlayer])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0, playerPropKey: 'collectibles' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should filter by player prop keys and values', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '8')
      ])
    })).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([channel, player, otherPlayer])

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0, playerPropKey: 'collectibles', playerPropValue: '8' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should filter by player groups', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_CHANNELS])

    const rule = new PlayerGroupRule(PlayerGroupRuleName.GTE, 'props.someRandomProp')
    rule.castType = PlayerGroupRuleCastType.DOUBLE
    rule.operands = ['60']

    const group = await new PlayerGroupFactory()
      .construct(apiKey.game).
      state(() => ({ rules: [rule] }))
      .one()

    const player = await new PlayerFactory([apiKey.game]).state((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'someRandomProp', '60')
      ])
    })).one()
    const otherPlayer = await new PlayerFactory([apiKey.game]).one()
    const channel = await new GameChannelFactory(apiKey.game).one()
    channel.members.add(player.aliases[0])
    channel.members.add(otherPlayer.aliases[0])
    await em.persistAndFlush([group, channel, player, otherPlayer])
    await group.checkMembership(em)

    const res = await request(app)
      .get(`/v1/game-channels/${channel.id}/members`)
      .query({ page: 0, playerGroupId: group.id })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.members).toHaveLength(1)
    expect(res.body.members[0].id).toBe(player.aliases[0].id)
    expect(res.body.count).toBe(1)
    expect(res.body.isLastPage).toBe(true)
  })
})
