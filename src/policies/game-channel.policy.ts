import GameChannel from '../entities/game-channel'
import { UserType } from '../entities/user'
import Policy from './policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import UserTypeGate from './user-type-gate'

export default class GameChannelPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true
    const { gameId } = req.params
    return this.canAccessGame(Number(gameId))
  }

  async post(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true
    const { gameId } = req.params
    return this.canAccessGame(Number(gameId))
  }

  async canAccessChannel(req: Request): Promise<PolicyResponse> {
    const { id, gameId } = req.params

    const channel = await this.em.getRepository(GameChannel).findOne(Number(id), {
      populate: ['members']
    })
    if (!channel) return new PolicyDenial({ message: 'Game channel not found' }, 404)

    this.ctx.state.channel = channel

    return this.canAccessGame(Number(gameId))
  }

  async put(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true
    return this.canAccessChannel(req)
  }

  @UserTypeGate([UserType.ADMIN], 'delete game channels')
  async delete(req: Request): Promise<PolicyResponse> {
    if (this.isAPICall()) return true
    return this.canAccessChannel(req)
  }
}
