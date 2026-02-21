import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Game channel - post', () => {
  it('should create a game channel', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-channels`)
      .send({ name: 'Test channel', props: [], autoCleanup: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_CHANNEL_CREATED,
      game,
    })

    expect(res.body.channel.name).toBe('Test channel')
    expect(activity!.extra.channelName).toBe('Test channel')
  })

  it('should not create a game channel for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post(`/games/${otherGame.id}/game-channels`)
      .send({ name: 'Test channel', props: [], autoCleanup: false })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not create a game channel for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post('/games/99999/game-channels')
      .send({ name: 'Test channel', props: [], autoCleanup: false })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should set owner when ownerAliasId is provided', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)
    const player = await new PlayerFactory([game]).one()
    await em.persistAndFlush(player)

    const res = await request(app)
      .post(`/games/${game.id}/game-channels`)
      .send({ name: 'Test channel', ownerAliasId: player.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.channel.owner.id).toBe(player.aliases[0].id)
  })

  it('should not create channel with non-existent ownerAliasId', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-channels`)
      .send({ name: 'Test channel', ownerAliasId: 99999 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Owner not found' })
  })
})
