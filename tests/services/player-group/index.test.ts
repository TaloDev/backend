import request from 'supertest'
import PlayerGroupFactory from '../../fixtures/PlayerGroupFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerGroup from '../../../src/entities/player-group'

describe('Player group service - index', () => {
  it('should return a list of groups', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const groups = await new PlayerGroupFactory().construct(game).many(3)
    await global.em.persistAndFlush(groups)

    const res = await request(global.app)
      .get(`/games/${game.id}/player-groups`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const sortedRes = res.body.groups.sort((a: PlayerGroup, b: PlayerGroup) => a.id.localeCompare(b.id))
    const sortedGroups = groups.sort((a, b) => a.id.localeCompare(b.id))

    sortedRes.forEach((group: PlayerGroup, idx: number) => {
      expect(group.id).toBe(sortedGroups[idx].id)
    })
  })

  it('should not return groups for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .get('/games/99999/player-groups')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return groups for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await request(global.app)
      .get(`/games/${game.id}/player-groups`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
