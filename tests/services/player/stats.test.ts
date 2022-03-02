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
import GameFactory from '../../fixtures/GameFactory'
import GameStatFactory from '../../fixtures/GameStatFactory'
import GameStat from '../../../src/entities/game-stat'
import PlayerGameStatFactory from '../../fixtures/PlayerGameStatFactory'
import casual from 'casual'

const baseUrl = '/players'

describe('Player service - get stats', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let stats: GameStat[]
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().one()
    validGame = await new GameFactory(user.organisation).one()
    stats = await new GameStatFactory([validGame]).many(3)
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame, ...stats])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should get a player\'s stats', async () => {
    const player = await new PlayerFactory([validGame]).one()
    const playerStats = await new PlayerGameStatFactory().construct(player, casual.random_element(stats)).many(3)

    await (<EntityManager>app.context.em).persistAndFlush([player, ...playerStats])

    const res = await request(app.callback())
      .get(`${baseUrl}/${player.id}/stats`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.stats).toHaveLength(3)
  })

  it('should not get a player\'s stats for a player they have no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const player = await new PlayerFactory([otherGame]).one()

    await (<EntityManager>app.context.em).persistAndFlush(player)

    await request(app.callback())
      .get(`${baseUrl}/${player.id}/stats`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get a player\'s stats if they do not exist', async () => {
    const res = await request(app.callback())
      .get(`${baseUrl}/21312321321/stats`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
