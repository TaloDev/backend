import request from 'supertest'
import { UserType } from '../../../../src/entities/user.js'
import GameFactory from '../../../fixtures/GameFactory.js'
import InviteFactory from '../../../fixtures/InviteFactory.js'
import UserFactory from '../../../fixtures/UserFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Organisation - current', () => {
  it.each(userPermissionProvider([UserType.ADMIN]))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation] = await createOrganisationAndGame()
      const [token, user] = await createUserAndToken({ type }, organisation)

      const otherUser = await new UserFactory().state(() => ({ organisation })).one()
      const invites = await new InviteFactory()
        .construct(organisation)
        .state(() => ({ invitedByUser: user }))
        .many(3)
      await em.persist([otherUser, ...invites]).flush()

      const res = await request(app)
        .get('/organisations/current')
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.games).toHaveLength(1)
        expect(res.body.members).toHaveLength(2)
        expect(res.body.pendingInvites).toHaveLength(invites.length)
      } else {
        expect(res.body).toStrictEqual({
          message: 'You do not have permissions to view organisation info',
        })
      }
    },
  )

  it('should return games in switcher order', async () => {
    const [organisation, lastGame] = await createOrganisationAndGame({}, { switcherOrder: 1 })
    const firstGame = await new GameFactory(organisation).state(() => ({ switcherOrder: 0 })).one()
    await em.persist(firstGame).flush()

    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .get('/organisations/current')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.games.map((game: { id: number }) => game.id)).toStrictEqual([
      firstGame.id,
      lastGame.id,
    ])
  })
})
