import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import GameFactory from '../../../fixtures/GameFactory'
import LeaderboardFactory from '../../../fixtures/LeaderboardFactory'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Leaderboard service - post', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'desc', unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_CREATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.leaderboard.internalName).toBe('highscores')
      expect(res.body.leaderboard.name).toBe('Highscores')
      expect(res.body.leaderboard.sortMode).toBe('desc')

      expect(activity!.extra.leaderboardInternalName).toBe(res.body.leaderboard.internalName)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create leaderboards' })

      expect(activity).toBeNull()
    }
  })

  it('should not create a leaderboard for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post(`/games/${otherGame.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'desc', unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not create a leaderboard for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post('/games/99999/leaderboards')
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'desc', unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a leaderboard with an invalid sort mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'blah', unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        sortMode: ['Sort mode must be one of desc, asc']
      }
    })
  })

  it('should not create a leaderboard with a duplicate internal name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({ internalName: 'highscores' })).one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'highscores', name: 'Highscores', sortMode: 'asc', unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        internalName: ['A leaderboard with the internalName \'highscores\' already exists']
      }
    })
  })

  it('should create a leaderboard with a duplicate internal name for another game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const otherGame = await new GameFactory(organisation).one()
    const otherLeaderboard = await new LeaderboardFactory([otherGame]).state(() => ({ internalName: 'time-survived' })).one()
    await em.persistAndFlush(otherLeaderboard)

    await request(app)
      .post(`/games/${game.id}/leaderboards`)
      .send({ internalName: 'time-survived', name: 'Time survived', sortMode: 'asc', unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(200)
  })
})
