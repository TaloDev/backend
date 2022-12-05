import { EntityManager } from '@mikro-orm/core'
import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'

describe('Leaderboard service - update entry', () => {
  it('should mark a leaderboard entry as hidden', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).one()
    await (<EntityManager>global.em).persistAndFlush(entry)

    const res = await request(global.app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(true)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
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

    expect(activity).not.toBeNull()
  })

  it('should mark an entry as unhidden', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).state('hidden').one()
    await (<EntityManager>global.em).persistAndFlush(entry)

    const res = await request(global.app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({ hidden: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(false)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
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
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const players = await new PlayerFactory([game]).many(10)
    const entry = await new LeaderboardEntryFactory(leaderboard, players).state('hidden').one()
    await (<EntityManager>global.em).persistAndFlush(entry)

    const res = await request(global.app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/${entry.id}`)
      .send({})
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entry.hidden).toBe(true)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
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
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await (<EntityManager>global.em).persistAndFlush(leaderboard)

    const res = await request(global.app)
      .patch(`/games/${game.id}/leaderboards/${leaderboard.id}/entries/12312321`)
      .send({ hidden: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard entry not found' })
  })
})
