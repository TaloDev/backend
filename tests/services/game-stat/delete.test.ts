import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import User from '../../../src/entities/user'
import { genAccessToken } from '../../../src/lib/auth/buildTokenPair'
import UserFactory from '../../fixtures/UserFactory'
import GameFactory from '../../fixtures/GameFactory'
import Game from '../../../src/entities/game'
import OrganisationFactory from '../../fixtures/OrganisationFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import GameStatFactory from '../../fixtures/GameStatFactory'

const baseUrl = '/game-stats'

describe('Game stat service - delete', () => {
  let app: Koa
  let user: User
  let validGame: Game
  let token: string

  beforeAll(async () => {
    app = await init()

    user = await new UserFactory().state('admin').one()
    validGame = await new GameFactory(user.organisation).one()
    await (<EntityManager>app.context.em).persistAndFlush([user, validGame])

    token = await genAccessToken(user)
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should delete a stat', async () => {
    const stat = await new GameStatFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    await request(app.callback())
      .delete(`${baseUrl}/${stat.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_DELETED,
      extra: {
        statInternalName: stat.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should not delete a stat for demo users', async () => {
    const invalidUser = await new UserFactory().state('demo').with(() => ({ organisation: validGame.organisation })).one()
    const stat = await new GameStatFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([invalidUser, stat])

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .delete(`${baseUrl}/${stat.id}`)
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete stats' })
  })

  it('should not delete a stat for dev users', async () => {
    const invalidUser = await new UserFactory().with(() => ({ organisation: validGame.organisation })).one()
    const stat = await new GameStatFactory([validGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([invalidUser, stat])

    const invalidUserToken = await genAccessToken(invalidUser)

    const res = await request(app.callback())
      .delete(`${baseUrl}/${stat.id}`)
      .auth(invalidUserToken, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete stats' })
  })

  it('should not delete a stat for a game the user has no access to', async () => {
    const otherOrg = await new OrganisationFactory().one()
    const otherGame = await new GameFactory(otherOrg).one()
    const stat = await new GameStatFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush([otherOrg, otherGame, stat])

    await request(app.callback())
      .delete(`${baseUrl}/${stat.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not delete a non-existent stat', async () => {
    const res = await request(app.callback())
      .delete(`${baseUrl}/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
