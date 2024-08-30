import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import GameFeedbackCategoryFactory from '../../../fixtures/GameFeedbackCategoryFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { subHours } from 'date-fns'

describe('Game feedback API service - post', () => {
  it('should create feedback if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_FEEDBACK])

    const feedbackCategory = await new GameFeedbackCategoryFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>global.em).persistAndFlush([feedbackCategory, player])

    const res = await request(global.app)
      .post(`/v1/game-feedback/categories/${feedbackCategory.internalName}`)
      .send({ comment: 'This is my comment' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(200)

    expect(res.body.feedback).toMatchObject({
      comment: 'This is my comment',
      anonymised: feedbackCategory.anonymised
    })
  })

  it('should not create feedback if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const feedbackCategory = await new GameFeedbackCategoryFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>global.em).persistAndFlush([feedbackCategory, player])

    const res = await request(global.app)
      .post(`/v1/game-feedback/categories/${feedbackCategory.internalName}`)
      .send({ comment: 'This is my comment' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Missing access key scope: write:gameFeedback' })
  })

  it('should not create feedback for a missing player', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_FEEDBACK])

    const feedbackCategory = await new GameFeedbackCategoryFactory(apiKey.game).one()
    await (<EntityManager>global.em).persistAndFlush(feedbackCategory)

    const res = await request(global.app)
      .post(`/v1/game-feedback/categories/${feedbackCategory.internalName}`)
      .send({ comment: 'This is my comment' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '12345')
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should not create feedback for a non-existent category', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_FEEDBACK])

    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .post('/v1/game-feedback/categories/non-existent')
      .send({ comment: 'This is my comment' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Feedback category not found' })
  })

  it('should set the createdAt for the feedback to the continuity date', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_GAME_FEEDBACK, APIKeyScope.WRITE_CONTINUITY_REQUESTS])

    const feedbackCategory = await new GameFeedbackCategoryFactory(apiKey.game).one()
    const player = await new PlayerFactory([apiKey.game]).one()

    await (<EntityManager>global.em).persistAndFlush([feedbackCategory, player])

    const continuityDate = subHours(new Date(), 1)

    const res = await request(global.app)
      .post(`/v1/game-feedback/categories/${feedbackCategory.internalName}`)
      .send({ comment: 'This is my comment' })
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .set('x-talo-continuity-timestamp', String(continuityDate.getTime()))
      .expect(200)

    expect(res.body.feedback.createdAt).toBe(continuityDate.toISOString())
  })
})
