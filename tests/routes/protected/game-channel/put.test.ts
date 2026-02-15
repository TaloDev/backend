import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import GameChannel from '../../../../src/entities/game-channel'
import PlayerFactory from '../../../fixtures/PlayerFactory'

describe('Game channel - put', () => {
  it('should update a game channel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ name: 'Updated channel', props: [{ key: 'test', value: 'value' }] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_CHANNEL_UPDATED,
      game
    })

    expect(res.body.channel.name).toBe('Updated channel')
    expect(activity!.extra.channelName).toBe('Updated channel')

    expect(activity!.extra.display).toStrictEqual({
      'Updated properties': 'name: Updated channel, props: [{"key":"test","value":"value"}]'
    })
  })

  it('should not update a game channel the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const channel = await new GameChannelFactory(game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ name: 'Updated channel' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update a game channel for a non-existent game', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const channel = await new GameChannelFactory(game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/99999/game-channels/${channel.id}`)
      .send({ name: 'Updated channel' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not update a non-existent game channel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/99999`)
      .send({ name: 'Updated channel' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game channel not found' })
  })

  it('should not update owner to a non-existent player alias', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ ownerAliasId: 99999 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'New owner not found' })
  })

  it('should add the new owner to members if not already a member', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).one()
    const player = await new PlayerFactory([game]).one()
    await em.persist([channel, player]).flush()

    await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ ownerAliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refreshOrFail(channel, { populate: ['members'] })
    expect(channel.members.length).toBe(1)
    expect(channel.members.getIdentifiers()).toContain(player.aliases[0].id)
  })

  it('should not update the channel name when set to whitespace', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).one()
    await em.persist(channel).flush()

    const originalName = channel.name

    await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ name: '   ' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const updatedChannel = await em.getRepository(GameChannel).findOneOrFail(channel.id)
    expect(updatedChannel.name).toBe(originalName)
  })

  it('should update the autoCleanup property', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).state(() => ({ autoCleanup: false })).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ autoCleanup: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.autoCleanup).toBe(true)
  })

  it('should update the private property', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).state(() => ({ private: false })).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ private: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.private).toBe(true)
  })

  it('should update the temporaryMembership property', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const channel = await new GameChannelFactory(game).state(() => ({ temporaryMembership: false })).one()
    await em.persist(channel).flush()

    const res = await request(app)
      .put(`/games/${game.id}/game-channels/${channel.id}`)
      .send({ temporaryMembership: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.temporaryMembership).toBe(true)
  })
})
