import { Collection } from '@mikro-orm/mysql'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import PlayerProp from '../../../../src/entities/player-prop.js'
import { UserType } from '../../../../src/entities/user.js'
import { createToken } from '../../../../src/routes/protected/api-key/common.js'
import GameStatFactory from '../../../fixtures/GameStatFactory.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Game - update', () => {
  it('should update game names', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        name: 'New game name',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.name).toBe('New game name')

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_NAME_UPDATED,
      game,
      extra: {
        display: {
          'Previous name': game.name,
        },
      },
    })
    expect(activity).not.toBeNull()
  })

  it.each(userPermissionProvider())(
    'should update purgeDevPlayers for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ purgeDevPlayers: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).purgeDevPlayers).toBe(true)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update purgeLivePlayers for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ purgeLivePlayers: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).purgeLivePlayers).toBe(true)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update the website for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const website = 'https://example.com'
      await request(app)
        .patch(`/games/${game.id}`)
        .send({ website })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).website).toBe(website)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update purgeDevPlayersRetention for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ purgeDevPlayersRetention: 30 })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).purgeDevPlayersRetention).toBe(30)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update purgeLivePlayersRetention for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ purgeLivePlayersRetention: 60 })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).purgeLivePlayersRetention).toBe(60)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update blockAliasIdentifierProfanity for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ blockAliasIdentifierProfanity: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).blockAliasIdentifierProfanity).toBe(true)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update blockPropsProfanity for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ blockPropsProfanity: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).blockPropsProfanity).toBe(true)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update verifyRequests for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ verifyRequests: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).verifyRequests).toBe(true)
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update displayNamePropKey for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ displayNamePropKey: 'playerChosenName' })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).displayNamePropKey).toBe('playerChosenName')
      }
    },
  )

  it.each(userPermissionProvider())(
    'should update the logoUrl for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      const logoUrl = 'https://example.com/logo.png'
      await request(app)
        .patch(`/games/${game.id}`)
        .send({ logoUrl })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).logoUrl).toBe(logoUrl)
      }
    },
  )

  it('should not update game names if an empty string is sent', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({ name: '' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        name: ['Name must be a non-empty string'],
      },
    })
  })

  it('should create a GAME_SETTINGS_UPDATED activity when updating game settings', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    await request(app)
      .patch(`/games/${game.id}`)
      .send({
        purgeDevPlayers: true,
        website: 'https://example.com',
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_SETTINGS_UPDATED,
      game,
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.display).toEqual({
      'Updated properties': 'purgeDevPlayers: true, website: https://example.com',
    })
  })

  it('should not create a GAME_SETTINGS_UPDATED activity when no settings are changed', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      {
        purgeDevPlayers: true,
      },
    )
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    await request(app)
      .patch(`/games/${game.id}`)
      .send({
        purgeDevPlayers: true,
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_SETTINGS_UPDATED,
      game,
    })

    expect(activity).toBeNull()
  })

  it('should clear cached api keys after updating settings', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const apiKey = new APIKey(game, user)
    apiKey.scopes = [APIKeyScope.WRITE_GAME_STATS]
    await em.persist(apiKey).flush()
    const apiToken = await createToken(em, apiKey)

    const stat = await new GameStatFactory([game])
      .state(() => ({ defaultValue: 0, maxChange: 1, maxValue: 1000 }))
      .one()
    const player = await new PlayerFactory([game]).one()

    await em.persist([stat, player]).flush()

    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(apiToken, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    await request(app)
      .patch(`/games/${game.id}`)
      .send({ verifyRequests: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // now requires a signature
    await request(app)
      .put(`/v1/game-stats/${stat.internalName}`)
      .send({ change: 1 })
      .auth(apiToken, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(401)
  })

  it('should return the correct displayName based on displayNamePropKey', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const player = await new PlayerFactory([game])
      .state((p) => ({
        props: new Collection<PlayerProp>(p, [
          new PlayerProp(p, 'displayNameOne', 'Alice'),
          new PlayerProp(p, 'displayNameTwo', 'Bob'),
        ]),
      }))
      .one()
    await em.persist(player).flush()

    // first search: should use the identifier
    const resBefore = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(resBefore.body.players).toHaveLength(1)
    expect(resBefore.body.players[0].aliases[0].displayName).toBe(player.aliases[0].identifier)

    // set the display name prop key to displayNameOne
    await request(app)
      .patch(`/games/${game.id}`)
      .send({ displayNamePropKey: 'displayNameOne' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // second search: should use displayNameOne
    const resAfterSettingOne = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(resAfterSettingOne.body.players).toHaveLength(1)
    expect(resAfterSettingOne.body.players[0].aliases[0].displayName).toBe('Alice')

    // set the display name prop key to displayNameTwo
    await request(app)
      .patch(`/games/${game.id}`)
      .send({ displayNamePropKey: 'displayNameTwo' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    // third search: should use displayNameTwo
    const resAfterSettingTwo = await request(app)
      .get(`/games/${game.id}/players`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(resAfterSettingTwo.body.players).toHaveLength(1)
    expect(resAfterSettingTwo.body.players[0].aliases[0].displayName).toBe('Bob')
  })

  it.each(userPermissionProvider())(
    'should update playerAuthActivityEnrichment for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type }, organisation)

      await request(app)
        .patch(`/games/${game.id}`)
        .send({ playerAuthActivityEnrichment: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect((await em.refreshOrFail(game)).playerAuthActivityEnrichment).toBe(true)
      }
    },
  )
})
