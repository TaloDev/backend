import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import GameStatFactory from '../../fixtures/GameStatFactory'
import clearEntities from '../../utils/clearEntities'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Game stat service - delete', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  beforeEach(async () => {
    await clearEntities(app.context.em, ['GameActivity'])
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type, emailConfirmed: true }, organisation)

    const stat = await new GameStatFactory([game]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    await request(app.callback())
      .delete(`/games/${game.id}/game-stats/${stat.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_STAT_DELETED,
      extra: {
        statInternalName: stat.internalName
      }
    })

    if (statusCode === 204) {
      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should not delete a stat for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const stat = await new GameStatFactory([otherGame]).one()
    await (<EntityManager>app.context.em).persistAndFlush(stat)

    const res = await request(app.callback())
      .delete(`/games/${otherGame.id}/game-stats/${stat.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a non-existent stat', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
      .delete(`/games/${game.id}/game-stats/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Stat not found' })
  })
})
