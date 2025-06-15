import { ForwardTo, HasPermission, Request, Response, Route, Validate, forwardRequest } from 'koa-clay'
import GameFeedbackAPIPolicy from '../../policies/api/game-feedback-api.policy'
import APIService from './api-service'
import GameFeedback from '../../entities/game-feedback'
import GameFeedbackAPIDocs from '../../docs/game-feedback-api.docs'
import { EntityManager } from '@mikro-orm/mysql'
import GameFeedbackCategory from '../../entities/game-feedback-category'
import { TraceService } from '../../lib/tracing/trace-service'

@TraceService()
export default class GameFeedbackAPIService extends APIService {
  @Route({
    method: 'GET',
    path: '/categories',
    docs: GameFeedbackAPIDocs.indexCategories
  })
  @HasPermission(GameFeedbackAPIPolicy, 'indexCategories')
  @ForwardTo('games.game-feedback', 'indexCategories')
  async indexCategories(req: Request): Promise<Response> {
    return forwardRequest(req)
  }

  @Route({
    method: 'POST',
    path: '/categories/:internalName',
    docs: GameFeedbackAPIDocs.post
  })
  @HasPermission(GameFeedbackAPIPolicy, 'post')
  @Validate({
    headers: ['x-talo-alias'],
    body: [GameFeedback]
  })
  async post(req: Request): Promise<Response> {
    const { comment } = req.body
    const em: EntityManager = req.ctx.em

    const category: GameFeedbackCategory = req.ctx.state.category

    const feedback = new GameFeedback(category, req.ctx.state.alias)
    feedback.comment = comment
    feedback.anonymised = category.anonymised
    if (req.ctx.state.continuityDate) {
      feedback.createdAt = req.ctx.state.continuityDate
    }

    await em.persistAndFlush(feedback)

    return {
      status: 200,
      body: {
        feedback
      }
    }
  }
}
