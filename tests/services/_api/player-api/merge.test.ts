import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import APIKey, { APIKeyScope } from '../../../../src/entities/api-key'
import { createToken } from '../../../../src/services/api-key.service'
import UserFactory from '../../../fixtures/UserFactory'
import OrganisationFactory from '../../../fixtures/OrganisationFactory'
import GameFactory from '../../../fixtures/GameFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import Player from '../../../../src/entities/player'
import PlayerAlias from '../../../../src/entities/player-alias'

const baseUrl = '/v1/players/merge'

describe('Player API service - merge', () => {
  let app: Koa
  let apiKey: APIKey
  let token: string

  beforeAll(async () => {
    app = await init()

    const user = await new UserFactory().one()
    const organisation = await new OrganisationFactory().one()
    const game = await new GameFactory(organisation).one()

    apiKey = new APIKey(game, user)
    token = await createToken(apiKey)

    await (<EntityManager>app.context.em).persistAndFlush(apiKey)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should not merge with no scopes', async () => {
    apiKey.scopes = []
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ alias1: 1, alias2: 2 })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): read:players, write:players' })
  })


  it('should not merge without the write scope', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ alias1: 1, alias2: 2 })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): write:players' })
  })


  it('should not merge without the read scope', async () => {
    apiKey.scopes = [APIKeyScope.WRITE_PLAYERS]
    await (<EntityManager>app.context.em).flush()
    token = await createToken(apiKey)

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ alias1: 1, alias2: 2 })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope(s): read:players' })
  })

  it('should merge player2 into player1', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]
    token = await createToken(apiKey)

    const player1 = await new PlayerFactory([apiKey.game]).one()
    let player2 = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ alias1: player1.aliases[0].id, alias2: player2.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.id).toBe(player1.id)

    await (<EntityManager>app.context.em).clear()

    const prevId = player2.id
    player2 = await (<EntityManager>app.context.em).getRepository(Player).findOne(prevId)
    expect(player2).toBeNull()

    const aliases = await (<EntityManager>app.context.em).getRepository(PlayerAlias).find({ player: prevId })
    expect(aliases).toHaveLength(0)
  })

  it('should correctly replace properties in player1 with player2\'s', async () => {
    apiKey.scopes = [APIKeyScope.READ_PLAYERS, APIKeyScope.WRITE_PLAYERS]
    token = await createToken(apiKey)

    const player1 = await new PlayerFactory([apiKey.game]).with(() => ({
      props: [
        {
          key: 'currentLevel',
          value: '60'
        },
        {
          key: 'currentHealth',
          value: '66'
        },
        {
          key: 'pos.x',
          value: '50'
        },
        {
          key: 'pos.y',
          value: '-30'
        }
      ]
    })).one()

    const player2 = await new PlayerFactory([apiKey.game]).with(() => ({
      props: [
        {
          key: 'currentLevel',
          value: '60'
        },
        {
          key: 'pos.x',
          value: '58'
        },
        {
          key: 'pos.y',
          value: '-24'
        },
        {
          key: 'pos.z',
          value: '4'
        }
      ]
    })).one()

    await (<EntityManager>app.context.em).persistAndFlush([player1, player2])

    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ alias1: player1.aliases[0].id, alias2: player2.aliases[0].id })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.props).toStrictEqual([
      {
        key: 'currentLevel',
        value: '60'
      },
      {
        key: 'pos.x',
        value: '58'
      },
      {
        key: 'pos.y',
        value: '-24'
      },
      {
        key: 'pos.z',
        value: '4'
      },
      {
        key: 'currentHealth',
        value: '66'
      }
    ])
  })
})
