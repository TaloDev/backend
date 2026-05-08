import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Integration from './integration'

type GameCenterRequest = {
  url: string
  method: 'GET'
}

type GameCenterResponse<T = { [key: string]: unknown }> = {
  status: number
  body: T
  timeTaken: number
}

@Entity()
export default class GameCenterIntegrationEvent {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Integration)
  integration: Integration

  @Property({ type: 'json' })
  request!: GameCenterRequest

  @Property({ type: 'json' })
  response!: GameCenterResponse

  @Property()
  createdAt: Date = new Date()

  constructor(integration: Integration) {
    this.integration = integration
  }
}
