import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import PlayerPresenceFactory from '../../../fixtures/PlayerPresenceFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Headline service - online players', () => {
  it('should return the number of online players', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const onlinePlayers = await new PlayerFactory([game])
      .state(async (player) => ({ presence: await new PlayerPresenceFactory(player.game).online().one() }))
      .many(5)
    const offlinePlayers = await new PlayerFactory([game])
      .state(async (player) => ({ presence: await new PlayerPresenceFactory(player.game).offline().one() }))
      .many(5)

    await em.persist([...onlinePlayers, ...offlinePlayers]).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/online_players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(5)
  })

  it('should not return dev build online players without the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const onlinePlayers = await new PlayerFactory([game])
      .devBuild()
      .state(async (player) => ({ presence: await new PlayerPresenceFactory(player.game).online().one() }))
      .many(5)

    await em.persist(onlinePlayers).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/online_players`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.count).toBe(0)
  })

  it('should return dev build online players with the dev data header', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const onlinePlayers = await new PlayerFactory([game])
      .devBuild()
      .state(async (player) => ({ presence: await new PlayerPresenceFactory(player.game).online().one() }))
      .many(5)

    await em.persist(onlinePlayers).flush()

    const res = await request(app)
      .get(`/games/${game.id}/headlines/online_players`)
      .auth(token, { type: 'bearer' })
      .set('x-talo-include-dev-data', '1')
      .expect(200)

    expect(res.body.count).toBe(5)
  })
})
