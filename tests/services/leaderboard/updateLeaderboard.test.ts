import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory.js'
import { LeaderboardSortMode } from '../../../src/entities/leaderboard.js'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('Leaderboard service - update leaderboard', () => {
  it('should update a leaderboard\'s name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ name: 'The new name', internalName: leaderboard.internalName, sortMode: leaderboard.sortMode, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.name).toBe('The new name')

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_UPDATED,
      game,
      extra: {
        leaderboardInternalName: res.body.leaderboard.internalName
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should update a leaderboard\'s sort mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).state('desc').one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ sortMode: LeaderboardSortMode.ASC, internalName: leaderboard.internalName, name: leaderboard.name, unique: leaderboard.unique })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.sortMode).toBe('asc')
  })

  it('should update a leaderboard\'s entry uniqueness mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).state('unique').one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ unique: false, internalName: leaderboard.internalName, name: leaderboard.name, sortMode: leaderboard.sortMode })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.unique).toBe(false)
  })

  it('should not update a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .put(`/games/${game.id}/leaderboards/21312321`)
      .send({ internalName: 'this-does-not-exist', name: 'blah', sortMode: LeaderboardSortMode.ASC, unique: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })
})
