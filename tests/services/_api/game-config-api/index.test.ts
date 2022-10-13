import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../../src/index'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'

const baseUrl = '/v1/game-config'

describe('Game config API service - index', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return the game config if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.READ_GAME_CONFIG])
    await (<EntityManager>app.context.em).populate(apiKey, ['game'])

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.config).toHaveLength(apiKey.game.props.length)
  })

  it('should not return the game config if the scope is not valid', async () => {
    const [, token] = await createAPIKeyAndToken(app.context.em, [])

    await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should filter out meta props from the game config', async () => {
    const [apiKey, token] = await createAPIKeyAndToken(app.context.em, [APIKeyScope.READ_GAME_CONFIG])
    await (<EntityManager>app.context.em).populate(apiKey, ['game'])
    apiKey.game.props.push({ key: 'META_PREV_NAME', value: 'LD51' })
    await (<EntityManager>app.context.em).flush()

    const res = await request(app.callback())
      .get(baseUrl)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.config).toHaveLength(apiKey.game.props.length - 1)
  })
})
