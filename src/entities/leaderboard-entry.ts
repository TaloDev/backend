import { Entity, Index, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import { Collection } from '@mikro-orm/mysql'
import { createHash } from 'node:crypto'
import LeaderboardEntryProp from './leaderboard-entry-prop.js'
import Leaderboard from './leaderboard.js'
import PlayerAlias from './player-alias.js'

// asc leaderboard entry ordering
// deleted_at sits in the prefix so soft-deleted rows never get scanned
export const ascOrderIndexName = 'idx_leaderboardentry_order_asc'
const ascOrderIndexExpr = `alter table \`leaderboard_entry\` add index \`${ascOrderIndexName}\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`score\`, \`created_at\`, \`id\`)`

// desc leaderboard entry ordering - a reverse scan of the asc index would also reverse
// the createdAt/id tie-breaks, so score needs an explicit descending index part
export const descOrderIndexName = 'idx_leaderboardentry_order_desc'
const descOrderIndexExpr = `alter table \`leaderboard_entry\` add index \`${descOrderIndexName}\`(\`leaderboard_id\`, \`hidden\`, \`deleted_at\`, \`score\` desc, \`created_at\`, \`id\`)`

@Entity()
@Index({ name: ascOrderIndexName, expression: ascOrderIndexExpr })
@Index({ name: descOrderIndexName, expression: descOrderIndexExpr })
export default class LeaderboardEntry {
  @PrimaryKey()
  id!: number

  @Property({ type: 'double' })
  score!: number

  @ManyToOne(() => Leaderboard, { deleteRule: 'cascade' })
  leaderboard: Leaderboard

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade', eager: true })
  playerAlias!: PlayerAlias

  @OneToMany(() => LeaderboardEntryProp, (prop) => prop.leaderboardEntry, {
    eager: true,
    orphanRemoval: true,
  })
  props: Collection<LeaderboardEntryProp> = new Collection<LeaderboardEntryProp>(this)

  @Property({ default: false })
  hidden!: boolean

  @Index()
  @Property()
  propsDigest!: string

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt: Date | null = null

  static createPropsDigest(props: { key: string; value: string }[]) {
    const propsToHash = props.map((prop) => ({
      key: prop.key,
      value: prop.value,
    }))

    propsToHash.sort((a, b) => a.key.localeCompare(b.key))

    return createHash('sha256').update(JSON.stringify(propsToHash)).digest('hex')
  }

  constructor(leaderboard: Leaderboard) {
    this.leaderboard = leaderboard
  }

  setProps(props: { key: string; value: string }[]) {
    this.props.set(props.map(({ key, value }) => new LeaderboardEntryProp(this, key, value)))
  }

  toJSON() {
    return {
      id: this.id,
      score: this.score,
      leaderboardName: this.leaderboard.name,
      leaderboardInternalName: this.leaderboard.internalName,
      leaderboardSortMode: this.leaderboard.sortMode,
      playerAlias: this.playerAlias,
      hidden: this.hidden,
      props: this.props,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    }
  }
}
