import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Player group service - index', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should return a list of groups', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, {}, organisation)

    const groups = await new PlayerGroupFactory().construct(game).many(3)
    await (<EntityManager>app.context.em).persistAndFlush(groups)

    const res = await request(app.callback())
      .get(`/games/${game.id}/player-groups`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.groups.forEach((group, idx) => {
      expect(group.id).toBe(groups[idx].id)
    })
  })

  it('should not return groups for a non-existent game', async () => {
    const [token] = await createUserAndToken(app.context.em)

    const res = await request(app.callback())
      .get('/games/99999/player-groups')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return groups for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em)

    await request(app.callback())
      .get(`/games/${game.id}/player-groups`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
