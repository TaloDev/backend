import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import GameFeedbackFactory from '../../fixtures/GameFeedbackFactory'
import GameFeedbackCategoryFactory from '../../fixtures/GameFeedbackCategoryFactory'
import { EntityManager } from '@mikro-orm/mysql'

describe('Game feedback service - index', () => {
  it('should return a list of game feedback', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const feedback = await new GameFeedbackFactory(game).many(10)
    await (<EntityManager>global.em).persistAndFlush(feedback)

    const res = await request(global.app)
      .get(`/games/${game.id}/game-feedback`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    res.body.feedback.forEach((item, idx) => {
      expect(item.id).toBe(feedback[idx].id)
    })
  })

  it('should return a list of game feedback for a specific category', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantCategory = await new GameFeedbackFactory(game).with(() => ({ category })).many(5)
    const feedbackWithoutRelevantCategory = await new GameFeedbackFactory(game).many(5)
    await (<EntityManager>global.em).persistAndFlush([...feedbackWithRelevantCategory, ...feedbackWithoutRelevantCategory])

    const res = await request(global.app)
      .get(`/games/${game.id}/game-feedback?feedbackCategoryInternalName=${category.internalName}`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantCategory.length)
  })

  it('should not return game feedback for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .get('/games/99999/game-feedback')
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return game feedback for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await new GameFeedbackFactory(game).many(10)

    await request(global.app)
      .get(`/games/${game.id}/game-feedback`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
