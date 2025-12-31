import { Collection, Embedded, Entity, ManyToOne, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import GameSecret from './game-secret'
import Organisation from './organisation'
import Player from './player'
import Prop from './prop'

export const MAX_LIVE_CONFIG_VALUE_LENGTH = 4096

@Entity()
export default class Game {
  @PrimaryKey()
  id!: number

  @Property()
  name: string

  @ManyToOne(() => Organisation)
  organisation: Organisation

  @Embedded(() => Prop, { array: true })
  props: Prop[] = []

  @OneToMany(() => Player, (player) => player.game)
  players: Collection<Player> = new Collection<Player>(this)

  @OneToOne({ orphanRemoval: true })
  apiSecret!: GameSecret

  @Property()
  purgeDevPlayers: boolean = false

  @Property()
  purgeLivePlayers: boolean = false

  @Property({ nullable: true })
  website: string | null = null

  @Property()
  purgeDevPlayersRetention: number = 60

  @Property()
  purgeLivePlayersRetention: number = 90

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(name: string, organisation: Organisation) {
    this.name = name
    this.organisation = organisation
  }

  static getLiveConfigCacheKey(game: Game) {
    return `live-config-${game.id}`
  }

  getLiveConfig(): Prop[] {
    return this.props.filter((prop) => !prop.key.startsWith('META_'))
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
