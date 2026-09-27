import { randText } from '@ngneat/falso'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key.js'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import Prop from '../../../../src/entities/prop.js'
import { UserType } from '../../../../src/entities/user.js'
import { genAccessToken } from '../../../../src/lib/auth/buildTokenPair.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage.js'
import createTestSocket from '../../../utils/createTestSocket.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Game config - update', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame(
        {},
        {
          props: [
            { key: 'xpRate', value: '1' },
            { key: 'halloweenEventEnabled', value: '0' },
          ],
        },
      )
      const [token] = await createUserAndToken({ type }, organisation)

      const res = await request(app)
        .patch(`/games/${game.id}/game-config`)
        .send({
          props: [
            {
              key: 'xpRate',
              value: '2',
            },
          ],
        })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const activity = await em.repo(GameActivity).findOne({
        type: GameActivityType.GAME_PROPS_UPDATED,
        game,
      })

      if (statusCode === 200) {
        expect(res.body.game.props).toEqual(
          expect.arrayContaining([
            {
              key: 'xpRate',
              value: '2',
            },
            {
              key: 'halloweenEventEnabled',
              value: '0',
            },
          ]),
        )

        expect(activity).not.toBeNull()
      } else {
        expect(activity).toBeNull()
      }
    },
  )

  it('should delete null game config properties', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      {
        props: [
          { key: 'xpRate', value: '1' },
          { key: 'halloweenEventEnabled', value: '0' },
        ],
      },
    )
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}/game-config`)
      .send({
        props: [
          {
            key: 'xpRate',
            value: '1',
          },
          {
            key: 'halloweenEventEnabled',
            value: null,
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.props).toStrictEqual([
      {
        key: 'xpRate',
        value: '1',
      },
    ])
  })

  it("should not update a non-existent game's config", async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch('/games/2313/game-config')
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it("should not update a game's config the user has no access to", async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const res = await request(app)
      .patch(`/games/${otherGame.id}/game-config`)
      .send({
        props: [
          {
            key: 'xpRate',
            value: '2',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should reject keys starting with META_', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}/game-config`)
      .send({
        props: [
          {
            key: 'META_BREAK_THINGS',
            value: 'true',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: [
          "Prop keys starting with 'META_' are reserved for internal systems, please use another key name",
        ],
      },
    })
  })

  it('should notify players when the game config has been updated', async () => {
    const { identifyMessage, ticket, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CONFIG,
    ])

    apiKey.game.props = [new Prop('xpRate', '1')]
    apiKey.createdByUser.type = UserType.ADMIN
    await em.flush()

    const token = await genAccessToken(apiKey.createdByUser)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .patch(`/games/${apiKey.game.id}/game-config`)
        .send({
          props: [
            {
              key: 'xpRate',
              value: '2',
            },
          ],
        })
        .auth(token, { type: 'bearer' })
        .expect(200)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.live-config.updated')
        expect(actual.data.config).toStrictEqual([
          {
            key: 'xpRate',
            value: '2',
          },
        ])
      })
    })
  })

  it('should not notify players without the correct scope when the game config has been updated', async () => {
    const { identifyMessage, ticket, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
    ])

    apiKey.game.props = [new Prop('xpRate', '1')]
    apiKey.createdByUser.type = UserType.ADMIN
    await em.flush()

    const token = await genAccessToken(apiKey.createdByUser)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(app)
        .patch(`/games/${apiKey.game.id}/game-config`)
        .send({
          props: [
            {
              key: 'xpRate',
              value: '2',
            },
          ],
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

    const longKey = randText({ charCount: 129 })
    const res = await request(app)
      .patch(`/games/${game.id}/game-config`)
      .send({
        props: [
          {
            key: longKey,
            value: '1',
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['One or more props are invalid, see rejectedProps'],
      },
      rejectedProps: [
        {
          key: longKey,
          error: 'PROP_KEY_TOO_LONG',
          message: 'Prop key length (129) exceeds 128 characters',
        },
      ],
    })
  })

  it('should reject props where the value is greater than 4096 characters', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}/game-config`)
      .send({
        props: [
          {
            key: 'bio',
            value: randText({ charCount: 4097 }),
          },
        ],
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['One or more props are invalid, see rejectedProps'],
      },
      rejectedProps: [
        {
          key: 'bio',
          error: 'PROP_VALUE_TOO_LONG',
          message: 'Prop value length (4097) exceeds 4096 characters',
        },
      ],
    })
  })
})
