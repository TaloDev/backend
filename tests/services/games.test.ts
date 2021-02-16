import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../src/index'
import request from 'supertest'
import User from '../../src/entities/user'
import { genAccessToken } from '../../src/lib/auth/buildTokenPair'
import Game from '../../src/entities/game'

const baseUrl = '/games'

describe('Games service', () => {
  let app: Koa
  let user: User
  let token: string

  beforeAll(async () => {
    app = await init()

    user = new User()
    await (<EntityManager>app.context.em).persistAndFlush(user)

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should create a game', async () => {
    const res = await request(app.callback())
      .post(`${baseUrl}`)
      .send({ name: 'Twodoors' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.game.name).toBe('Twodoors')

    const game = await (<EntityManager>app.context.em).getRepository(Game).findOne(res.body.game.id, ['teamMembers'])
    const team = game.teamMembers.get()
    expect(team).toHaveLength(1)
    expect(team[0].id).toBe(user.id)
  })
})
