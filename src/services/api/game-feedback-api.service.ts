import { Docs, ForwardTo, HasPermission, Request, Response, Routes, Validate, forwardRequest } from 'koa-clay'
import GameFeedbackAPIPolicy from '../../policies/api/game-feedback-api.policy'
import APIService from './api-service'
import GameFeedback from '../../entities/game-feedback'
import GameFeedbackAPIDocs from '../../docs/game-feedback-api.docs'
import { EntityManager } from '@mikro-orm/mysql'
import GameFeedbackCategory from '../../entities/game-feedback-category'

@Routes([
  {
    method: 'GET',
    path: '/categories',
    handler: 'indexCategories'
  },
  {
    method: 'POST',
    path: '/categories/:internalName'
  }
])
export default class GameFeedbackAPIService extends APIService {
  @HasPermission(GameFeedbackAPIPolicy, 'indexCategories')
  @ForwardTo('games.game-feedback', 'indexCategories')
  @Docs(GameFeedbackAPIDocs.indexCategories)
  async indexCategories(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @HasPermission(GameFeedbackAPIPolicy, 'post')
  @Validate({
    headers: ['x-talo-alias'],
    body: [GameFeedback]
  })
  @Docs(GameFeedbackAPIDocs.post)
  async post(req: Request): Promise<Response> {
    const { comment } = req.body
    const em: EntityManager = req.ctx.em

    const category: GameFeedbackCategory = req.ctx.state.category

    const feedback = new GameFeedback(category, req.ctx.state.playerAlias)
    feedback.comment = comment
    feedback.anonymised = category.anonymised

    await em.persistAndFlush(feedback)

    return {
      status: 200,
      body: {
        feedback
      }
    }
  }
}
