import { Collection, Entity, Index, ManyToOne, OneToMany, PrimaryKey, Property } from '@mikro-orm/mysql'
import Leaderboard from './leaderboard'
import PlayerAlias from './player-alias'
import LeaderboardEntryProp from './leaderboard-entry-prop'

const scoreIndexName = 'idx_leaderboardentry_hidden_leaderboard_id_score'
const scoreIndexExpr = `alter table \`leaderboard_entry\` add index \`${scoreIndexName}\`(\`hidden\`, \`leaderboard_id\`, \`score\`)`

@Entity()
export default class LeaderboardEntry {
  @PrimaryKey()
  id!: number

  @Index({ name: scoreIndexName, expression: scoreIndexExpr })
  @Property({ type: 'double' })
  score!: number

  @ManyToOne(() => Leaderboard, { deleteRule: 'cascade' })
  leaderboard: Leaderboard

  @ManyToOne(() => PlayerAlias, { deleteRule: 'cascade', eager: true })
  playerAlias!: PlayerAlias

  @OneToMany(() => LeaderboardEntryProp, (prop) => prop.leaderboardEntry, { eager: true, orphanRemoval: true })
  props: Collection<LeaderboardEntryProp> = new Collection<LeaderboardEntryProp>(this)

  @Index()
  @Property({ default: false })
  hidden!: boolean

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ nullable: true })
  deletedAt: Date | null = null

  constructor(leaderboard: Leaderboard) {
    this.leaderboard = leaderboard
  }

  setProps(props: { key: string, value: string }[]) {
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
      props: this.props.getItems().map(({ key, value }) => ({ key, value })),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt
    }
  }
}
