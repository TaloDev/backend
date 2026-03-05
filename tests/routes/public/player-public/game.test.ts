import { randNumber } from '@ngneat/falso'
import Sqids from 'sqids'
import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('Player public - game', () => {
  it('should return the game name for a valid token', async () => {
    const [, game] = await createOrganisationAndGame()

    const res = await request(app).get(`/public/players/${game.getToken()}/game`).expect(200)

    expect(res.body.game.name).toBe(game.name)
  })

  it('should return 404 for an invalid token', async () => {
    await request(app).get('/public/players/invalidtoken/game').expect(404)
  })

  it('should return 404 for a malformed token', async () => {
    const [, game] = await createOrganisationAndGame()

    const token = new Sqids({ minLength: 8 }).encode([game.id, randNumber()])
    await request(app).get(`/public/players/${token}/game`).expect(404)
  })
})
