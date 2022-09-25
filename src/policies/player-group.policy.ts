import Policy from './policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'
import PlayerGroup from '../entities/player-group'

export default class PlayerGroupPolicy extends Policy {
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'create groups')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'update groups')
  async put(req: Request): Promise<PolicyResponse> {
    const { gameId, id } = req.params

    this.ctx.state.group = await this.em.getRepository(PlayerGroup).findOne(Number(id))
    if (!this.ctx.state.group) return new PolicyDenial({ message: 'Group not found' }, 404)

    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN, UserType.DEV], 'delete groups')
  async delete(req: Request): Promise<PolicyResponse> {
    const { gameId, id } = req.params

    this.ctx.state.group = await this.em.getRepository(PlayerGroup).findOne(Number(id))
    if (!this.ctx.state.group) return new PolicyDenial({ message: 'Group not found' }, 404)

    return await this.canAccessGame(Number(gameId))
  }
}
