import request from 'supertest'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('User - me', () => {
  it("should return the user's data", async () => {
    const [organisation] = await createOrganisationAndGame({}, { name: 'Vigilante 2084' })
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(app).get('/users/me').auth(token, { type: 'bearer' }).expect(200)

    expect(res.body.user).toBeTruthy()
    expect(res.body.user.organisation).toBeTruthy()
    expect(res.body.user.organisation.games).toHaveLength(1)
    expect(res.body.user.organisation.games[0].name).toBe('Vigilante 2084')
  })
})
