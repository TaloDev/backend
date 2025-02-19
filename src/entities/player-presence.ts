import { Cascade, Entity, ManyToOne, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import PlayerAlias from './player-alias'

export enum PlayerPresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline'
}

@Entity()
export default class PlayerPresence {
  @PrimaryKey()
  id: number

  @OneToOne(() => Player, (player) => player.presence)
  player: Player

  @ManyToOne(() => PlayerAlias, { cascade: [Cascade.REMOVE] })
  playerAlias: PlayerAlias

  @Property()
  online: boolean = false

  @Property()
  customStatus: string = ''

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(player: Player) {
    this.player = player
  }

  toJSON() {
    return {
      playerAlias: this.playerAlias ?? null,
      online: this.online,
      customStatus: this.customStatus,
      updatedAt: this.updatedAt
    }
  }
}
