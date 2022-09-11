import { Collection, EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerProp from '../../../src/entities/player-prop'

describe('Player service - patch', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    const player = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_PROPS_UPDATED,
      extra: {
        playerId: player.id
      }
    })

    if (statusCode === 200) {
      expect(res.body.player.props).toEqual(expect.arrayContaining(
        [
          {
            key: 'collectibles',
            value: '1'
          },
          {
            key: 'zonesExplored',
            value: '1'
          }
        ]
      ))

      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should delete null player properties', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '1'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          },
          {
            key: 'zonesExplored',
            value: null
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'collectibles',
        value: '1'
      }
    ])
  })

  it('should throw an error if props are present but aren\'t an array', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: {
          collectibles: '3'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        props: ['Props must be an array']
      }
    })
  })

  it('should not update a non-existent player\'s properties', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const res = await request(app.callback())
      .patch(`/games/${game.id}/players/2313`)
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

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not update a player\'s properties for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {})

    const player = await new PlayerFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`/games/${otherGame.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should filter out props with no keys', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player = await new PlayerFactory([game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: '',
            value: ''
          },
          {
            key: 'zonesExplored',
            value: '3'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'zonesExplored',
        value: '3'
      }
    ])
  })

  it('should reject keys starting with META_', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const player = await new PlayerFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`/games/${game.id}/players/${player.id}`)
      .send({
        props: [
          {
            key: 'zonesExplored',
            value: '3'
          },
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
