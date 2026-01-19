import request from 'supertest'
import LeaderboardFactory from '../../fixtures/LeaderboardFactory'
import { LeaderboardSortMode } from '../../../src/entities/leaderboard'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import PlayerFactory from '../../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../../fixtures/LeaderboardEntryFactory'
import { sub } from 'date-fns'

describe('Leaderboard service - update leaderboard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should update a leaderboard\'s name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ name: 'The new name', internalName: leaderboard.internalName, sortMode: leaderboard.sortMode, unique: leaderboard.unique, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.name).toBe('The new name')

    const activity = await em.getRepository(GameActivity).findOne({
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

    const leaderboard = await new LeaderboardFactory([game]).desc().one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ sortMode: LeaderboardSortMode.ASC, internalName: leaderboard.internalName, name: leaderboard.name, unique: leaderboard.unique, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.sortMode).toBe('asc')
  })

  it('should update a leaderboard\'s entry uniqueness mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).unique().one()
    await em.persistAndFlush(leaderboard)

    const res = await request(app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({ unique: false, internalName: leaderboard.internalName, name: leaderboard.name, sortMode: leaderboard.sortMode, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.unique).toBe(false)
  })

  it('should not update a non-existent leaderboard', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .put(`/games/${game.id}/leaderboards/21312321`)
      .send({ internalName: 'this-does-not-exist', name: 'blah', sortMode: LeaderboardSortMode.ASC, unique: true, refreshInterval: 'never' })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Leaderboard not found' })
  })

  it('should archive entries when changing refresh interval from never', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const leaderboard = await new LeaderboardFactory([game]).one()
    const player = await new PlayerFactory([game]).one()
    const entry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: sub(new Date(), { days: 2 }) }))
      .one()

    await em.persistAndFlush([leaderboard, entry])

    const res = await request(app)
      .put(`/games/${game.id}/leaderboards/${leaderboard.id}`)
      .send({
        refreshInterval: 'daily',
        internalName: leaderboard.internalName,
        name: leaderboard.name,
        sortMode: leaderboard.sortMode,
        unique: leaderboard.unique
      })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.leaderboard.refreshInterval).toBe('daily')

    await em.refresh(entry)
    expect(entry.deletedAt).toBeDefined()
  })
})
