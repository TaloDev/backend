import request from 'supertest'
import { UserType } from '../../../../src/entities/user'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Game  - settings', () => {
  it.each(userPermissionProvider([]))('should return settings for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    game.purgeDevPlayers = true
    game.purgeLivePlayers = false
    game.purgeDevPlayersRetention = 30
    game.purgeLivePlayersRetention = 60
    game.website = 'https://example.com'
    await em.flush()

    const res = await request(app)
      .get(`/games/${game.id}/settings`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.settings).toStrictEqual({
        purgeDevPlayers: true,
        purgeLivePlayers: false,
        purgeDevPlayersRetention: 30,
        purgeLivePlayersRetention: 60,
        website: 'https://example.com'
      })
    }
  })

  it('should not return settings for a non-existent game', async () => {
    const [organisation] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .get('/games/2313/settings')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return settings for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.OWNER })

    const res = await request(app)
      .get(`/games/${otherGame.id}/settings`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })
})
