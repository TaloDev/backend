import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Leaderboard service - search', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a leaderboard with the same internalName', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const leaderboard = await new LeaderboardFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const res = await request(app.callback())
      .get(`/games/${game.id}/leaderboards/search?internalName=${leaderboard.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.id).toBe(leaderboard.id)
  })

  it('should not return leaderboards for a non-existent game', async () => {
    const [token] = await createUserAndToken(app.context.em)

    const res = await request(app.callback())
      .get('/games/1234/leaderboards/search?internalName=blah')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return leaderboards from another game', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const leaderboard = await new LeaderboardFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(leaderboard)

    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const res = await request(app.callback())
      .get(`/games/${game.id}/leaderboards/search?internalName=${leaderboard.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
