import { Entity, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/mysql'
import PlayerGroup from './player-group'
import User from './user'

@Entity()
@Unique({ properties: ['user', 'group'] })
export default class UserPinnedGroup {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => User, { eager: true })
  user: User

  @ManyToOne(() => PlayerGroup, { eager: true })
  group: PlayerGroup

  @Property()
  createdAt: Date = new Date()

  static getCacheKeyForUser(user: User) {
    return `pinned-group-${user.id}`
  }

  constructor(user: User, group: PlayerGroup) {
    this.user = user
    this.group = group
  }
}
