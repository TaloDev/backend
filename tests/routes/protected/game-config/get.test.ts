import request from 'supertest'
import Prop from '../../../../src/entities/prop.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Game config - get', () => {
  it('should return the live config', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      {
        props: [new Prop('xpRate', '2'), new Prop('maxLevel', '80')],
      },
    )
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/game-config`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.config).toEqual(
      expect.arrayContaining([
        { key: 'xpRate', value: '2' },
        { key: 'maxLevel', value: '80' },
      ]),
    )
  })

  it('should return 403 for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({})

    await request(app)
      .get(`/games/${otherGame.id}/game-config`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
