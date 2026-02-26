import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Integration from './integration'

export type SteamworksRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type SteamworksRequest = {
  url: string
  method: SteamworksRequestMethod
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
