import request from 'supertest'
import { AdminAPIKeyScope } from '../../../../src/entities/admin-api-key.js'
import { UserType } from '../../../../src/entities/user.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Admin API key - scopes', () => {
  it('should return a list of admin api key scopes', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .get(`/games/${game.id}/admin-api-keys/scopes`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    const length = Object.keys(res.body.scopes).reduce((acc, curr) => {
      return acc + res.body.scopes[curr].length
    }, 0)
    expect(length).toBe(Object.keys(AdminAPIKeyScope).length - 1) // exclude full access
  })
})
