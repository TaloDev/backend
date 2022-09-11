import { Collection, EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import Game from '../../../../src/entities/game'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-key.service'
import UserFactory from '../../../fixtures/UserFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import PlayerProp from '../../../../src/entities/player-prop'

const baseUrl = '/v1/players'

describe('Player API service - patch', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    apiKey = new APIKey(new Game('Uplift', user.organisation), user)
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should update a player\'s properties', async () => {
    const player = await new PlayerFactory([apiKey.game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${player.aliases[0].id}`)
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

    expect(res.body.player.props).toEqual(expect.arrayContaining([
      {
        key: 'collectibles',
        value: '1'
      },
      {
        key: 'zonesExplored',
        value: '1'
      }
    ]))
  })

  it('should not update a player\'s properties if the scope is missing', async () => {
    const player = await new PlayerFactory([apiKey.game]).with((player) => ({
      props: new Collection<PlayerProp>(player, [
        new PlayerProp(player, 'collectibles', '0'),
        new PlayerProp(player, 'zonesExplored', '1')
      ])
    })).one()
    await (<EntityManager>app.context.em).persistAndFlush(player)

    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    await request(app.callback())
      .patch(`${baseUrl}/${player.aliases[0].id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not update a non-existent player\'s properties', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .patch(`${baseUrl}/546`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not update a player from another game\'s properties', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const otherPlayer = await new PlayerFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(otherPlayer)

    const res = await request(app.callback())
      .patch(`${baseUrl}/${otherPlayer.aliases[0].id}`)
      .send({
        props: [
          {
            key: 'collectibles',
            value: '1'
          }
        ]
      })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
