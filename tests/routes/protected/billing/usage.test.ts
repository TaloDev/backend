import request from 'supertest'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Billing - usage', () => {
  it.each(userPermissionProvider())(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation] = await createOrganisationAndGame({}, {})
      const [token] = await createUserAndToken({ type }, organisation)

      const limit = 10000
      const used = 999

      organisation.pricingPlan.pricingPlan.playerLimit = limit
      const players = await new PlayerFactory(organisation.games.getItems()).many(used)
      await em.persist(players).flush()

      const res = await request(app)
        .get('/billing/usage')
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.usage).toStrictEqual({
          limit,
          used,
        })
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to view the organisation pricing plan usage',
        })
      }
    },
  )
})
