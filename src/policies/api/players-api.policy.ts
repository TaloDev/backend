import Policy from '../policy'
import { ServicePolicyDenial, ServiceRequest } from 'koa-rest-services'
import PlayerAlias from '../../entities/player-alias'
import { EntityManager } from '@mikro-orm/mysql'
import Player from '../../entities/player'

export default class PlayersAPIPolicy extends Policy {
  async index(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('read:players')
  }

  async post(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('write:players')
  }

  async identify(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('read:players')
  }

  async patch(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScope('write:players')
  }

  async merge(req: ServiceRequest): Promise<boolean | ServicePolicyDenial> {
    return await this.hasScopes(['read:players', 'write:players'])
  }
}
