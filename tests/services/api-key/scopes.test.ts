import request from 'supertest'
import { UserType } from '../../../src/entities/user.js'
import { APIKeyScope } from '../../../src/entities/api-key.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'

describe('API key service - get scopes', () => {
  it('should return a list of api key scopes', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(global.app)
      .get(`/games/${game.id}/api-keys/scopes`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const length = Object.keys(res.body.scopes).reduce((acc, curr) => {
      return acc + res.body.scopes[curr].length
    }, 0)
    expect(length).toBe(Object.keys(APIKeyScope).length - 1) // exclude full access
  })
})
