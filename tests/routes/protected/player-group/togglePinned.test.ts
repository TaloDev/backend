import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import UserPinnedGroupFactory from '../../../fixtures/UserPinnedGroupFactory'
import PlayerGroupFactory from '../../../fixtures/PlayerGroupFactory'
import UserPinnedGroup from '../../../../src/entities/user-pinned-group'

describe('Player group - toggle pinned', () => {
  it('should pin a group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    await em.persistAndFlush(group)

    await request(app)
      .put(`/games/${game.id}/player-groups/${group.id}/toggle-pinned`)
      .send({ pinned: true })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.find(UserPinnedGroup, { group })).toHaveLength(1)
  })

  it('should unpin a group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    const pinnedGroup = await new UserPinnedGroupFactory().state(() => ({ user, group })).one()
    await em.persistAndFlush([group, pinnedGroup])

    await request(app)
      .put(`/games/${game.id}/player-groups/${group.id}/toggle-pinned`)
      .send({ pinned: false })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.find(UserPinnedGroup, { group })).toHaveLength(0)
  })

  it('should not re-pin a group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    const pinnedGroup = await new UserPinnedGroupFactory().state(() => ({ user, group })).one()
    await em.persistAndFlush([group, pinnedGroup])

    await request(app)
      .put(`/games/${game.id}/player-groups/${group.id}/toggle-pinned`)
      .send({ pinned: true })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.find(UserPinnedGroup, { group })).toHaveLength(1)
  })

  it('should handle unpinning a group that isn\'t pinned', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const group = await new PlayerGroupFactory().construct(game).one()
    await em.persistAndFlush(group)

    await request(app)
      .put(`/games/${game.id}/player-groups/${group.id}/toggle-pinned`)
      .send({ pinned: false })
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.find(UserPinnedGroup, { group })).toHaveLength(0)
  })

  it('should not update a group for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    const group = await new PlayerGroupFactory().construct(otherGame).one()
    await em.persistAndFlush(group)

    const res = await request(app)
      .put(`/games/${otherGame.id}/player-groups/${group.id}/toggle-pinned`)
      .send({ pinned: true })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update a non-existent group', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/player-groups/4324234/toggle-pinned`)
      .send({ pinned: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Group not found' })
  })
})
