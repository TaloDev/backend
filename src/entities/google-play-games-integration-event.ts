import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import Integration from './integration'

export type GooglePlayGamesRequest = {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body: string
}

export type GooglePlayGamesResponse<T = { [key: string]: unknown }> = {
  status: number
  body: T
  timeTaken: number
}

@Entity()
export default class GooglePlayGamesIntegrationEvent {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Integration)
  integration: Integration

  @Property({ type: 'json' })
  request!: GooglePlayGamesRequest

  @Property({ type: 'json' })
  response!: GooglePlayGamesResponse

  @Property()
  createdAt: Date = new Date()

  constructor(integration: Integration) {
    this.integration = integration
  }
}
