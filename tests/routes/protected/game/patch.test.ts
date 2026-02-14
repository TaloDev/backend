import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import createTestSocket from '../../../utils/createTestSocket'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import { genAccessToken } from '../../../../src/lib/auth/buildTokenPair'
import { APIKeyScope } from '../../../../src/entities/api-key'
import Prop from '../../../../src/entities/prop'
import { randText } from '@ngneat/falso'

describe('Game  - patch', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame({}, {
      props: [
        { key: 'xpRate', value: '1' },
        { key: 'halloweenEventEnabled', value: '0' }
      ]
    })
    const [token] = await createUserAndToken({ type }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        props: [
          {
            key: 'xpRate',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_PROPS_UPDATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.game.props).toEqual(expect.arrayContaining(
        [
          {
            key: 'xpRate',
            value: '2'
          },
          {
            key: 'halloweenEventEnabled',
            value: '0'
          }
        ]
      ))

      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should delete null player properties', async () => {
    const [organisation, game] = await createOrganisationAndGame({}, {
      props: [
        { key: 'xpRate', value: '1' },
        { key: 'halloweenEventEnabled', value: '0' }
      ]
    })
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        props: [
          {
            key: 'xpRate',
            value: '1'
          },
          {
            key: 'halloweenEventEnabled',
            value: null
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.props).toStrictEqual([
      {
        key: 'xpRate',
        value: '1'
      }
    ])
  })

  it('should not update a non-existent game\'s properties', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch('/games/2313')
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not update a player\'s properties for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const res = await request(app)
      .patch(`/games/${otherGame.id}`)
      .send({
        props: [
          {
            key: 'xpRate',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should reject keys starting with META_', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        props: [
          {
            key: 'META_BREAK_THINGS',
            value: 'true'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop keys starting with \'META_\' are reserved for internal systems, please use another key name']
      }
    })
  })

  it('should update game names', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        name: 'New game name'
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.name).toBe('New game name')

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_NAME_UPDATED,
      game,
      extra: {
        display: {
          'Previous name': game.name
        }
      }
    })
    expect(activity).not.toBeNull()
  })

  it('should notify players when the live config has been updated', async () => {
    const { identifyMessage, ticket, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CONFIG
    ])

    apiKey.game.props = [new Prop('xpRate', '1')]
    apiKey.createdByUser.type = UserType.ADMIN
    await em.flush()

    const token = await genAccessToken(apiKey.createdByUser)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .patch(`/games/${apiKey.game.id}`)
        .send({
          props: [
            {
              key: 'xpRate',
              value: '2'
            }
          ]
        })
        .auth(token, { type: 'bearer' })
        .expect(200)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.live-config.updated')
        expect(actual.data.config).toStrictEqual([
          {
            key: 'xpRate',
            value: '2'
          }
        ])
      })
    })
  })

  it('should not notify players without the correct scope when the live config has been updated', async () => {
    const { identifyMessage, ticket, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS
    ])

    apiKey.game.props = [new Prop('xpRate', '1')]
    apiKey.createdByUser.type = UserType.ADMIN
    await em.flush()

    const token = await genAccessToken(apiKey.createdByUser)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .patch(`/games/${apiKey.game.id}`)
        .send({
          props: [
            {
              key: 'xpRate',
              value: '2'
            }
          ]
        })
        .auth(token, { type: 'bearer' })
        .expect(200)
      await client.dontExpectJson((actual) => {
        expect(actual.res).toBe('v1.live-config.updated')
      })
    })
  })

  it('should reject props where the key is greater than 128 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        props: [
          {
            key: randText({ charCount: 129 }),
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop key length (129) exceeds 128 characters']
      }
    })
  })

  it('should reject props where the value is greater than 4096 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}`)
      .send({
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 4097 })
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Prop value length (4097) exceeds 4096 characters']
      }
    })
  })

  it.each(userPermissionProvider([]))('should update purgeDevPlayers for a %s user', async (statusCode, _, type) => {
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
  })

  it.each(userPermissionProvider([]))('should update purgeLivePlayers for a %s user', async (statusCode, _, type) => {
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
  })

  it.each(userPermissionProvider([]))('should update the website for a %s user', async (statusCode, _, type) => {
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
  })

  it.each(userPermissionProvider([]))('should update purgeDevPlayersRetention for a %s user', async (statusCode, _, type) => {
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
  })

  it.each(userPermissionProvider([]))('should update purgeLivePlayersRetention for a %s user', async (statusCode, _, type) => {
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
  })

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
        name: ['Name must be a non-empty string']
      }
    })
  })

  it('should create a GAME_SETTINGS_UPDATED activity when updating game settings', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    await request(app)
      .patch(`/games/${game.id}`)
      .send({
        purgeDevPlayers: true,
        website: 'https://example.com'
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_SETTINGS_UPDATED,
      game
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.display).toEqual({
      'Updated properties': 'purgeDevPlayers: true, website: https://example.com'
    })
  })

  it('should not create a GAME_SETTINGS_UPDATED activity when no settings are changed', async () => {
    const [organisation, game] = await createOrganisationAndGame({}, {
      purgeDevPlayers: true
    })
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    await request(app)
      .patch(`/games/${game.id}`)
      .send({
        purgeDevPlayers: true
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_SETTINGS_UPDATED,
      game
    })

    expect(activity).toBeNull()
  })
})
