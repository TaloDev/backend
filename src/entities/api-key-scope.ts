import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'
import APIKey from './api-key'

export enum Scope {
  CREATE_PLAYER
}

@Entity()
export default class APIKeyScope {
  @PrimaryKey()
  id: number

  @ManyToOne(() => APIKey)
  apiKey: APIKey

  @Property()
  scope: Scope

  @Property()
  createdAt: Date = new Date()

  constructor(apiKey: APIKey, scope: Scope) {
    this.apiKey = apiKey
    this.scope = scope
  }
}
