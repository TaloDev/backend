import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import PlayerFactory from '../../fixtures/PlayerFactory'
import PlayerAliasFactory from '../../fixtures/PlayerAliasFactory'
import GameChannelFactory from '../../fixtures/GameChannelFactory'
import GameChannelStoragePropFactory from '../../fixtures/GameChannelStoragePropFactory'

describe('Game channel service - storage', () => {
  it('should return a list of storage props for a channel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).one()

    const storageProps = await new GameChannelStoragePropFactory(channel).many(5)
    await em.persistAndFlush([channel, ...storageProps])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channelName).toBe(channel.name)
    expect(res.body.storageProps).toHaveLength(5)
    expect(res.body.count).toBe(5)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should not return storage props for a non-existent channel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/99999/storage`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should not return storage props for a channel the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).one()

    await em.persistAndFlush(channel)

    await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should paginate storage props', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).one()

    const count = 82
    const storageProps = await new GameChannelStoragePropFactory(channel).many(count)
    await em.persistAndFlush([channel, ...storageProps])

    const page = Math.floor(count / 50)

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.storageProps).toHaveLength(count % 50)
    expect(res.body.count).toBe(count)
    expect(res.body.itemsPerPage).toBe(50)
    expect(res.body.isLastPage).toBe(true)
  })

  it('should search storage props by key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).one()

    const matchingProps = await new GameChannelStoragePropFactory(channel).state(() => ({
      key: 'player_score'
    })).many(3)

    const nonMatchingProps = await new GameChannelStoragePropFactory(channel).state(() => ({
      key: 'guild_level'
    })).many(2)

    await em.persistAndFlush([channel, ...matchingProps, ...nonMatchingProps])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ search: 'player_score', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.storageProps).toHaveLength(3)
  })

  it('should search storage props by value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).one()

    const matchingProps = await new GameChannelStoragePropFactory(channel).state(() => ({
      value: 'legendary'
    })).many(2)

    const nonMatchingProps = await new GameChannelStoragePropFactory(channel).state(() => ({
      value: 'common'
    })).many(3)

    await em.persistAndFlush([channel, ...matchingProps, ...nonMatchingProps])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ search: 'legendary', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.storageProps).toHaveLength(2)
  })

  it('should search storage props by the createdBy alias identifier', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).state(() => ({
      identifier: 'admin_user'
    })).one()

    const otherPlayerAlias = await new PlayerAliasFactory(player).state(() => ({
      identifier: 'regular_user'
    })).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: playerAlias
    })).one()

    const propsCreatedByAdmin = await new GameChannelStoragePropFactory(channel).state(() => ({
      createdBy: playerAlias,
      lastUpdatedBy: playerAlias
    })).many(3)

    const propsCreatedByOther = await new GameChannelStoragePropFactory(channel).state(() => ({
      createdBy: otherPlayerAlias,
      lastUpdatedBy: otherPlayerAlias
    })).many(2)

    await em.persistAndFlush([channel, ...propsCreatedByAdmin, ...propsCreatedByOther])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ search: 'admin_user', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.storageProps).toHaveLength(3)
  })

  it('should search storage props by the lastUpdatedBy alias identifier', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).one()
    const creatorAlias = await new PlayerAliasFactory(player).state(() => ({
      identifier: 'creator'
    })).one()

    const editorAlias = await new PlayerAliasFactory(player).state(() => ({
      identifier: 'editor_123'
    })).one()

    const channel = await new GameChannelFactory(game).state(() => ({
      owner: creatorAlias
    })).one()

    const propsUpdatedByEditor = await new GameChannelStoragePropFactory(channel).state(() => ({
      createdBy: creatorAlias,
      lastUpdatedBy: editorAlias
    })).many(4)

    const propsUpdatedByCreator = await new GameChannelStoragePropFactory(channel).state(() => ({
      createdBy: creatorAlias,
      lastUpdatedBy: creatorAlias
    })).many(2)

    await em.persistAndFlush([channel, ...propsUpdatedByEditor, ...propsUpdatedByCreator])

    const res = await request(app)
      .get(`/games/${game.id}/game-channels/${channel.id}/storage`)
      .query({ search: 'editor_123', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.storageProps).toHaveLength(4)
  })
})
