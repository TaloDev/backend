import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('Data export service - available entities', () => {
  it('should return a list of available data export entities', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/data-exports/entities`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.entities).toStrictEqual([ 'events', 'players', 'playerAliases', 'leaderboardEntries', 'gameStats', 'playerGameStats', 'gameActivities' ])
  })
})
