import { Collection, Embedded, Entity, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/core'
import Organisation from './organisation'
import Player from './player'
import Prop from './prop'

@Entity()
export default class Game {
  @PrimaryKey()
  id: number

  @Property()
  name: string

  @ManyToOne(() => Organisation)
  organisation: Organisation

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @OneToMany(() => Player, (player) => player.game)
  players: Collection<Player> = new Collection<Player>(this)

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(name: string, organisation: Organisation) {
    this.name = name
    this.organisation = organisation
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      props: this.props,
      createdAt: this.createdAt
    }
  }
}
