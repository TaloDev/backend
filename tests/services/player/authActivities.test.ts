import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import PlayerFactory from '../../fixtures/PlayerFactory'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import userPermissionProvider from '../../utils/userPermissionProvider'
import { UserType } from '../../../src/entities/user'
import PlayerAuthActivityFactory from '../../fixtures/PlayerAuthActivityFactory'

describe('Player service - get auth activities', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const player = await new PlayerFactory([game]).withTaloAlias().one()
    const activities = await new PlayerAuthActivityFactory(game).state(() => ({ player })).many(10)

    await (<EntityManager>global.em).persistAndFlush(activities)

    const res = await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.activities).toHaveLength(10)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view player auth activities' })
    }
  })

  it('should not get a player\'s auth activities for a player they have no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const player = await new PlayerFactory([game]).one()

    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .get(`/games/${game.id}/players/${player.id}/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should not get a player\'s auth activities if they do not exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/players/21312321321/auth-activities`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })
})
