import { subMonths } from 'date-fns'
import request from 'supertest'
import DeletedPlayer from '../../../../src/entities/deleted-player.js'
import { UserType } from '../../../../src/entities/user.js'
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
        expect(res.body).toStrictEqual({
          usage: {
            limit,
            used,
          },
          breakdown: {
            live: used,
            dev: 0,
            deleted: 0,
          },
        })
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to view the organisation pricing plan usage',
        })
      }
    },
  )

  it('should return a breakdown of live, dev and deleted players', async () => {
    const [organisation, game] = await createOrganisationAndGame({}, {})
    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const livePlayers = await new PlayerFactory([game]).many(3)
    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    await em.persist([...livePlayers, ...devPlayers]).flush()

    // a deleted player created this month counts
    const deletedThisMonth = await new PlayerFactory([game]).one()
    await em.persist(deletedThisMonth).flush()
    await em.persist(new DeletedPlayer(deletedThisMonth)).flush()
    await em.remove(deletedThisMonth).flush()

    // a deleted player created last month does not count
    const lastMonthDeletedPlayer = new DeletedPlayer(livePlayers[0])
    lastMonthDeletedPlayer.createdAt = subMonths(new Date(), 1)
    await em.persist(lastMonthDeletedPlayer).flush()

    const res = await request(app).get('/billing/usage').auth(token, { type: 'bearer' }).expect(200)

    expect(res.body).toStrictEqual({
      usage: {
        limit: organisation.pricingPlan.pricingPlan.playerLimit,
        used: 3 + 2 + 1,
      },
      breakdown: {
        live: 3,
        dev: 2,
        deleted: 1,
      },
    })
  })
})
