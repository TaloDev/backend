import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Player from './player'
import { MAX_KEY_LENGTH, MAX_VALUE_LENGTH } from './prop'

const valueIndexName = 'idx_playerprop_key_value'
const valueIndexExpr = `alter table \`player_prop\` add index \`${valueIndexName}\`(\`key\`, \`value\`)`

@Entity()
export default class PlayerProp {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player, { deleteRule: 'cascade' })
  player: Player

  @Index()
  @Property({ length: MAX_KEY_LENGTH })
  key: string

  @Index({ name: valueIndexName, expression: valueIndexExpr })
  @Property({ length: MAX_VALUE_LENGTH })
  value: string

  @Property()
  createdAt: Date = new Date()

  constructor(player: Player, key: string, value: string) {
    this.player = player
    this.key = key
    this.value = value
  }
}
