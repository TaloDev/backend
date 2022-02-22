import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import Game from '../../../src/entities/game'
import UserFactory from '../../fixtures/UserFactory'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

const baseUrl = '/players'

describe('Player service - patch', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = new Game('Uplift', user.organisation)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update a player\'s properties', async () => {
    const player = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'collectibles',
          value: '0'
        },
        {
          key: 'zonesExplored',
          value: '1'
        }
      ]
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

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

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_PROPS_UPDATED,
      extra: {
        playerId: player.id
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should delete null player properties', async () => {
    const player = await new PlayerFactory([validGame]).with(() => ({
      props: [
        {
          key: 'collectibles',
          value: '1'
        },
        {
          key: 'zonesExplored',
          value: '1'
        }
      ]
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
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
    const player = await new PlayerFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: {
          collectibles: '3'
        }
      })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({ message: 'Props must be an array' })
  })

  it('should not update a non-existent player\'s properties', async () => {
    const res = await request(app.callback())
      .patch(`${baseUrl}/2313`)
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
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = new Game('Trigeon', otherOrg)
    const player = await new PlayerFactory([otherGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
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
  })

  it('should not update a player\'s properties if using a demo account', async () => {
    const demoUser = await new UserFactory().state('demo').one()
    const player = await new PlayerFactory([validGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush([demoUser, player])

    const demoToken = await genAccessToken(demoUser)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '2'
          }
        ]
      })
      .auth(demoToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Demo accounts cannot update player properties' })
  })
})
