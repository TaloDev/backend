import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import clearEntities from '../../utils/clearEntities'

describe('Game service - patch', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['GameActivity'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em, {}, {
      props: [
        { key: 'xpRate', value: '1' },
        { key: 'halloweenEventEnabled', value: '0' }
      ]
    })
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    const res = await request(app.callback())
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

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_PROPS_UPDATED
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
    const [organisation, game] = await createOrganisationAndGame(app.context.em, {}, {
      props: [
        { key: 'xpRate', value: '1' },
        { key: 'halloweenEventEnabled', value: '0' }
      ]
    })
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
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
    const [organisation] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
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
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const res = await request(app.callback())
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
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
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
