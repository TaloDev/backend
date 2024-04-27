import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Integration from './integration'

export type SteamworksRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type SteamworksResponseStatusCode = 200 | 400 | 401 | 403 | 404 | 405 | 429 | 500 | 503

export type SteamworksRequest = {
  url: string
  method: SteamworksRequestMethod
  body: string
}

export type SteamworksResponse = {
  status: SteamworksResponseStatusCode
  body: {
    [key: string]: unknown
  }
  timeTaken: number
}

@Entity()
export default class SteamworksIntegrationEvent {
  @PrimaryKey()
  id: number

  @ManyToOne(() => Integration)
  integration: Integration

  @Property({ type: 'json' })
  request: SteamworksRequest

  @Property({ type: 'json' })
  response: SteamworksResponse

  @Property()
  createdAt: Date = new Date()

  constructor(integration: Integration) {
    this.integration = integration
  }
}
