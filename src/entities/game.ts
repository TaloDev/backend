import { Collection, Embedded, Entity, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property, Rel } from '@mikro-orm/mysql'
import GameSecret from './game-secret.js'
import Organisation from './organisation.js'
import Player from './player.js'
import Prop from './prop.js'

@Entity()
export default class Game {
  @PrimaryKey()
  id: number

  @Property()
  name: string

  @ManyToOne(() => Organisation)
  organisation: Rel<Organisation>

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @OneToMany(() => Player, (player) => player.game)
  players: Collection<Player> = new Collection<Player>(this)

  @OneToOne({ orphanRemoval: true })
  apiSecret: Rel<GameSecret>

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(name: string, organisation: Rel<Organisation>) {
    this.name = name
    this.organisation = organisation
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      props: this.props,
      playerCount: this.players.isInitialized() ? this.players.count() : undefined,
      createdAt: this.createdAt
    }
  }
}
