import { addDays } from 'date-fns'
import request from 'supertest'
import ScheduledGameConfigChange from '../../../../../src/entities/scheduled-game-config-change.js'
import createOrganisationAndGame from '../../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../../utils/createUserAndToken.js'

describe('Scheduled game config change - list', () => {
  it('should list the game changes ordered by applyAt', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', '3', addDays(new Date(), 2)),
        new ScheduledGameConfigChange(game, user, 'xpRate', '2', addDays(new Date(), 1)),
      ])
      .flush()

    const res = await request(app)
      .get(`/games/${game.id}/game-config/scheduled-changes`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.changes.map((change: ScheduledGameConfigChange) => change.value)).toStrictEqual(
      ['2', '3'],
    )
  })

  it('should not return changes from other games', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, otherGame] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', '2', addDays(new Date(), 1)),
        new ScheduledGameConfigChange(otherGame, user, 'xpRate', '3', addDays(new Date(), 1)),
      ])
      .flush()

    const res = await request(app)
      .get(`/games/${game.id}/game-config/scheduled-changes`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.changes).toHaveLength(1)
  })
})
