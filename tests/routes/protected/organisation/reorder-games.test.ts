import request from 'supertest'
import Game from '../../../../src/entities/game.js'
import { UserType } from '../../../../src/entities/user.js'
import GameFactory from '../../../fixtures/GameFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'
import userPermissionProvider from '../../../utils/userPermissionProvider.js'

describe('Organisation - reorder games', () => {
  it.each(userPermissionProvider())(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, firstGame] = await createOrganisationAndGame({}, { switcherOrder: 0 })
      const secondGame = await new GameFactory(organisation)
        .state(() => ({ switcherOrder: 1 }))
        .one()
      const thirdGame = await new GameFactory(organisation)
        .state(() => ({ switcherOrder: 2 }))
        .one()
      await em.persist([secondGame, thirdGame]).flush()

      const [token] = await createUserAndToken({ type }, organisation)

      const originalOrder = [firstGame.id, secondGame.id, thirdGame.id]
      const newOrder = [...originalOrder].reverse()

      const res = await request(app)
        .put('/organisations/games/order')
        .send({ gameIds: newOrder })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      const updatedGames = await em
        .repo(Game)
        .find({ organisation }, { orderBy: { switcherOrder: 'asc' } })

      const expectedOrder = statusCode === 200 ? newOrder : originalOrder
      expect(updatedGames.map((game) => game.id)).toStrictEqual(expectedOrder)

      if (statusCode === 200) {
        expect(res.body.games.map((game: Game) => game.id)).toStrictEqual(newOrder)
      } else {
        expect(res.body).toStrictEqual({ message: 'You do not have permissions to reorder games' })
      }
    },
  )

  it('should ignore games outside the organisation', async () => {
    const [organisation, firstGame] = await createOrganisationAndGame({}, { switcherOrder: 0 })
    const secondGame = await new GameFactory(organisation).state(() => ({ switcherOrder: 1 })).one()
    await em.persist(secondGame).flush()

    const [, otherGame] = await createOrganisationAndGame({}, { switcherOrder: 5 })

    const [token] = await createUserAndToken({ type: UserType.OWNER }, organisation)

    const res = await request(app)
      .put('/organisations/games/order')
      .send({ gameIds: [otherGame.id, firstGame.id, secondGame.id] })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.games.map((game: Game) => game.id)).toStrictEqual([firstGame.id, secondGame.id])

    const updatedGames = await em
      .repo(Game)
      .find({ organisation }, { orderBy: { switcherOrder: 'asc' } })
    expect(updatedGames.map((game) => game.id)).toStrictEqual([firstGame.id, secondGame.id])
    expect((await em.refreshOrFail(otherGame)).switcherOrder).toBe(5)
  })
})
