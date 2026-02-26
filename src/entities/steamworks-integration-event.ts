import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import {
  SteamworksRequest,
  SteamworksResponse,
} from '../lib/integrations/clients/steamworks-client'
import Integration from './integration'

@Entity()
export default class SteamworksIntegrationEvent {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Integration)
  integration: Integration

  @Property({ type: 'json' })
  request!: SteamworksRequest

  @Property({ type: 'json' })
  response!: SteamworksResponse

  @Property()
  createdAt: Date = new Date()

  constructor(integration: Integration) {
    this.integration = integration
  }
}
