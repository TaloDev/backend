import Policy from './policy'
import { PolicyDenial, PolicyResponse, Request } from 'koa-clay'
import { UserType } from '../entities/user'
import UserTypeGate from './user-type-gate'
import Integration from '../entities/integration'

export default class IntegrationPolicy extends Policy {
  @UserTypeGate([UserType.ADMIN], 'view integrations')
  async index(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  @UserTypeGate([UserType.ADMIN], 'add integrations')
  async post(req: Request): Promise<PolicyResponse> {
    const { gameId } = req.params
    return await this.canAccessGame(Number(gameId))
  }

  async getIntegration(id: number): Promise<Integration> {
    this.ctx.state.integration = await this.em.getRepository(Integration).findOne(Number(id), { populate: ['game'] })
    return this.ctx.state.integration
  }

  @UserTypeGate([UserType.ADMIN], 'update integrations')
  async patch(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const integration = await this.getIntegration(Number(id))
    if (!integration) return new PolicyDenial({ message: 'Integration not found' }, 404)

    return await this.canAccessGame(integration.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'delete integrations')
  async delete(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const integration = await this.getIntegration(Number(id))
    if (!integration) return new PolicyDenial({ message: 'Integration not found' }, 404)

    return await this.canAccessGame(integration.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'sync leaderboards')
  async syncLeaderboards(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const integration = await this.getIntegration(Number(id))
    if (!integration) return new PolicyDenial({ message: 'Integration not found' }, 404)

    if (!integration.getConfig().syncLeaderboards) return new PolicyDenial({ message: 'Leaderboard syncing is not enabled' })

    return await this.canAccessGame(integration.game.id)
  }

  @UserTypeGate([UserType.ADMIN], 'sync stats')
  async syncStats(req: Request): Promise<PolicyResponse> {
    const { id } = req.params

    const integration = await this.getIntegration(Number(id))
    if (!integration) return new PolicyDenial({ message: 'Integration not found' }, 404)

    if (!integration.getConfig().syncStats) return new PolicyDenial({ message: 'Stat syncing is not enabled' })

    return await this.canAccessGame(integration.game.id)
  }
}
