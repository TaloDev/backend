import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('Game service - patch', () => {
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

    const res = await request(global.app)
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

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
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

    const res = await request(global.app)
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

    const res = await request(global.app)
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

    const res = await request(global.app)
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

    const res = await request(global.app)
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
      message: 'Prop keys starting with \'META_\' are reserved for internal systems, please use another key name'
    })
  })
})
