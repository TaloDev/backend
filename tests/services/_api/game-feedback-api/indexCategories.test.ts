import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import GameFeedbackCategoryFactory from '../../../fixtures/GameFeedbackCategoryFactory'

describe('Game feedback API service - index categories', () => {
  it('should get categories if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.READ_GAME_FEEDBACK])

    const feedbackCategory = await new GameFeedbackCategoryFactory(apiKey.game).one()
    await global.em.persistAndFlush(feedbackCategory)

    const res = await request(global.app)
      .get('/v1/game-feedback/categories')
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedbackCategories).toHaveLength(1)

    expect(res.body.feedbackCategories[0]).toMatchObject({
      id: feedbackCategory.id,
      internalName: feedbackCategory.internalName,
      name: feedbackCategory.name,
      description: feedbackCategory.description,
      anonymised: feedbackCategory.anonymised
    })
  })

  it('should not get categories if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const feedbackCategory = await new GameFeedbackCategoryFactory(apiKey.game).one()
    await global.em.persistAndFlush(feedbackCategory)

    const res = await request(global.app)
      .get('/v1/game-feedback/categories')
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope: read:gameFeedback' })
  })
})
