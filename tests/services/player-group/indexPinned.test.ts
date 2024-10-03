import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import UserPinnedGroupFactory from '../../fixtures/UserPinnedGroupFactory'

describe('Player group service - index pinned', () => {
  it('should return a list of groups', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    const pinned = await new UserPinnedGroupFactory().state(() => ({ user })).many(3)
    await (<EntityManager>global.em).persistAndFlush(pinned)

    const res = await request(global.app)
      .get(`/games/${game.id}/player-groups/pinned`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.groups).toHaveLength(pinned.length)
  })

  it('should not return groups for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .get('/games/99999/player-groups/pinned')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return groups for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(global.app)
      .get(`/games/${game.id}/player-groups/pinned`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
