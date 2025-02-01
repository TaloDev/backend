import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import userPermissionProvider from '../../utils/userPermissionProvider'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { UserType } from '../../../src/entities/user'

describe('Billing service - usage', () => {
  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation] = await createOrganisationAndGame({}, {})
    const [token] = await createUserAndToken({ type }, organisation)

    const limit = 10000
    const used = 999

    organisation.pricingPlan.pricingPlan.playerLimit = limit
    const players = await new PlayerFactory(organisation.games.getItems()).many(used)
    await (<EntityManager>global.em).persistAndFlush(players)

    const res = await request(global.app)
      .get('/billing/usage')
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.usage).toStrictEqual({
        limit,
        used
      })
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view the organisation pricing plan usage' })
    }
  })

  it('should not count anonymised player aliases towards usage', async () => {
    const [organisation] = await createOrganisationAndGame({}, {})
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const limit = 10000
    organisation.pricingPlan.pricingPlan.playerLimit = limit

    const anonymisedPlayers = await new PlayerFactory(organisation.games.getItems()).withAnonymisedTaloAlias().many(3)
    const normalPlayers = await new PlayerFactory(organisation.games.getItems()).many(2)
    await (<EntityManager>global.em).persistAndFlush([...anonymisedPlayers, ...normalPlayers])

    const res = await request(global.app)
      .get('/billing/usage')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.usage).toStrictEqual({
      limit,
      used: normalPlayers.length
    })
  })

  it('should count players with both anonymised and non-anonymised aliases', async () => {
    const [organisation] = await createOrganisationAndGame({}, {})
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const limit = 10000
    organisation.pricingPlan.pricingPlan.playerLimit = limit

    const player = await new PlayerFactory(organisation.games.getItems())
      .withUsernameAliasAndAnonymisedTaloAlias()
      .one()

    await (<EntityManager>global.em).persistAndFlush([player])

    const res = await request(global.app)
      .get('/billing/usage')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.usage).toStrictEqual({
      limit,
      used: 1
    })
  })
})
