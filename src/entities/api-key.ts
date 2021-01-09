import { Collection, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Game from './game'
import { v4 } from 'uuid'
import APIKeyScope from './api-key-scope'

@Entity()
export default class APIKey {
  @PrimaryKey()
  id: string = v4()

  // @ManyToOne(() => User)
  // user: User

  @OneToMany(() => APIKeyScope, (scope) => scope.apiKey)
  scopes = new Collection<APIKeyScope>(this)

  @ManyToOne(() => Game)
  game: Game

  @Property()
  createdAt: Date = new Date()

  @Property({ nullable: true })
  revokedAt?: Date
}
