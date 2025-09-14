import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import PlayerAliasFactory from '../../fixtures/PlayerAliasFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameChannelFactory from '../../fixtures/GameChannelFactory'
import GameChannel from '../../../src/entities/game-channel'
import GameChannelProp from '../../../src/entities/game-channel-prop'
import { Collection } from '@mikro-orm/mysql'

describe('Game channel service - index', () => {
  it('should return a list of game channels', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channels = await new GameChannelFactory(game).many(10)
    await em.persistAndFlush(channels)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.channels.forEach((item: GameChannel, idx: number) => {
      expect(item.id).toBe(channels[idx].id)
    })
  })

  it('should not return game channels for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/game-channels')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return game channels for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await new GameChannelFactory(game).many(10)

    await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should paginate results when getting channels', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const count = 82
    const channels = await new GameChannelFactory(game).many(count)
    await em.persistAndFlush(channels)

    const page = Math.floor(count / 50)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(channels.length % 50)
    expect(res.body.count).toBe(channels.length)
    expect(res.body.itemsPerPage).toBe(50)
  })

  it('should search by channel name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channelsWithName = await new GameChannelFactory(game).state(() => ({ name: 'General chat' })).many(3)
    const channelsWithoutName = await new GameChannelFactory(game).state(() => ({ name: 'Guild chat' })).many(3)
    await em.persistAndFlush([...channelsWithName, ...channelsWithoutName])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ search: 'General', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(channelsWithName.length)
  })

  it('should search by owners', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).state(async () => ({ player, identifier: 'johnny_the_admin' })).one()

    const channelsWithOwner = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).many(3)

    const channelsWithoutOwner = await new GameChannelFactory(game).many(5)

    await em.persistAndFlush([...channelsWithOwner, ...channelsWithoutOwner])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ search: 'johnny_the_admin', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(channelsWithOwner.length)
  })

  it('should return all players with the member count if the dev data header is sent', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).one()
    channel.members.add(
      (await new PlayerFactory([game]).devBuild().one()).aliases[0],
      (await new PlayerFactory([game]).one()).aliases[0]
    )
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.channels[0].memberCount).toBe(2)
  })

  it('should not return dev build players in the member count if the dev data header is not sent', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).one()
    channel.members.add(
      (await new PlayerFactory([game]).devBuild().one()).aliases[0],
      (await new PlayerFactory([game]).one()).aliases[0]
    )
    await em.persistAndFlush(channel)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels[0].memberCount).toBe(1)
  })

  it('should mark the last page of channels', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channels = await new GameChannelFactory(game).many(208)
    await em.persistAndFlush(channels)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 4 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(8)
    expect(res.body.count).toBe(208)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should return private channels', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const publicChannels = await new GameChannelFactory(game).many(3)
    const privateChannels = await new GameChannelFactory(game).private().many(1)
    await em.persistAndFlush([...publicChannels, ...privateChannels])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(publicChannels.length + privateChannels.length)
  })

  it('should filter game channels by prop keys', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).state((channel) => ({
      props: new Collection<GameChannelProp>(channel, [
        new GameChannelProp(channel, 'guildId', '15')
      ])
    })).one()

    const otherChannel = await new GameChannelFactory(game).one()

    await em.persistAndFlush([channel, otherChannel])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0, propKey: 'guildId' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(1)
    expect(res.body.channels[0].id).toBe(channel.id)
  })

  it('should filter game channels by prop keys and values', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).state((channel) => ({
      props: new Collection<GameChannelProp>(channel, [
        new GameChannelProp(channel, 'guildId', '15')
      ])
    })).one()

    const otherChannel = await new GameChannelFactory(game).state((channel) => ({
      props: new Collection<GameChannelProp>(channel, [
        new GameChannelProp(channel, 'guildId', '17')
      ])
    })).one()

    const irrelevantChannel = await new GameChannelFactory(game).one()

    await em.persistAndFlush([channel, otherChannel, irrelevantChannel])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels`)
      .query({ page: 0, propKey: 'guildId', propValue: '15' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channels).toHaveLength(1)
    expect(res.body.channels[0].id).toBe(channel.id)
  })
})
