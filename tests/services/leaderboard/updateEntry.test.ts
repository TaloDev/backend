import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import { UserType } from '../../../src/entities/user'
import userPermissionProvider from '../../utils/userPermissionProvider'

describe('Leaderboard service - update entry', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ]))('should mark a leaderboard entry as hidden with %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).one()
    await em.persistAndFlush(entry)

    const res = await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRY_HIDDEN,
      game,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        display: {
          'Player': entry.playerAlias.player.id,
          'Score': entry.score
        }
      }
    })

    if (statusCode === 200) {
      expect(res.body.entry.hidden).toBe(true)
      expect(activity).not.toBeNull()
    } else {
      expect(activity).toBeNull()
    }
  })

  it('should mark an entry as unhidden', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).hidden().one()
    await em.persistAndFlush(entry)

    const res = await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(false)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRY_RESTORED,
      game,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        display: {
          'Player': entry.playerAlias.player.id,
          'Score': entry.score
        }
      }
    })

    expect(activity).not.toBeNull()
  })

  it('should not mark an entry as unhidden if the hidden property isn\'t sent', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).hidden().one()
    await em.persistAndFlush(entry)

    const res = await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({})
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(true)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRY_HIDDEN,
      game,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        display: {
          'Player': entry.playerAlias.player.id,
          'Score': entry.score
        }
      }
    })

    expect(activity).toBeNull()
  })

  it('should not update a non-existent entry', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/12312321`)
      .send({ hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard entry not found' })
  })

  it('should update a leaderboard entry\'s score', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).state(() => ({ score: 100 })).one()
    await em.persistAndFlush(entry)

    const res = await request(app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ newScore: 200 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.score).toBe(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.LEADERBOARD_ENTRY_UPDATED,
      game,
      extra: {
        leaderboardInternalName: entry.leaderboard.internalName,
        entryId: entry.id,
        display: {
          'Player': entry.playerAlias.player.id,
          'Leaderboard': entry.leaderboard.internalName,
          'Old score': 100,
          'New score': 200
        }
      }
    })

    expect(activity).not.toBeNull()
  })
})
