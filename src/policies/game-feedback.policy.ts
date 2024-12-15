import Policy from './policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'
import GameFeedbackCategory from '../entities/game-feedback-category'

export default class GameFeedbackPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async indexCategories(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true

    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async getFeedbackCategory(id: number): Promise<GameFeedbackCategory> {
    this.ctx.state.feedbackCategory = await this.em.getRepository(GameFeedbackCategory).findOne(Number(id), { populate: ['game'] })
    return this.ctx.state.feedbackCategory
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create feedback categories')
  async postCategory(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'update feedback categories')
  async putCategory(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const feedbackCategory = await this.getFeedbackCategory(Number(id))
    if (!feedbackCategory) return new PolicyDenial({ message: 'Feedback category not found' }, 404)

    return await this.canAccessGame(feedbackCategory.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'delete feedback categories')
  async deleteCategory(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const feedbackCategory = await this.getFeedbackCategory(Number(id))
    if (!feedbackCategory) return new PolicyDenial({ message: 'Feedback category not found' }, 404)

    return await this.canAccessGame(feedbackCategory.game.id)
  }
}
