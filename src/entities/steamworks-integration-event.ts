import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import Integration from './integration'

export type SteamworksRequest = {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body: string
}

export type SteamworksResponse<T = { [key: string]: unknown }> = {
  status: number
  body: T
  timeTaken: number
}

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
