import { EntityManager } from '@mikro-orm/core'
import Koa from 'koa'
import init from '../../../src/index'
import request from 'supertest'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import clearEntities from '../../utils/clearEntities'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'

describe('Player group service - delete', () => {
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
    UserType.DEV,
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type }, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    await (<EntityManager>app.context.em).persistAndFlush(group)

    const res = await request(app.callback())
      .delete(`/games/${game.id}/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await (<EntityManager>app.context.em).getRepository(GameActivity).findOne({
      type: GameActivityType.PLAYER_GROUP_DELETED
    })

    if (statusCode === 204) {
      expect(activity.extra.groupName).toBe(group.name)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to delete groups' })

      expect(activity).toBeNull()
    }
  })

  it('should not delete a group for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN })

    const group = await new PlayerGroupFactory().construct(otherGame).one()
    await (<EntityManager>app.context.em).persistAndFlush([group])

    const res = await request(app.callback())
      .delete(`/games/${otherGame.id}/player-groups/${group.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not delete a non-existent group', async () => {
    const [organisation, game] = await createOrganisationAndGame(app.context.em)
    const [token] = await createUserAndToken(app.context.em, { type: UserType.ADMIN }, organisation)

    const res = await request(app.callback())
      .delete(`/games/${game.id}/player-groups/31223`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Group not found' })
  })
})
