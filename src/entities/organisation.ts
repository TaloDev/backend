import { Collection, Entity, OneToMany, OneToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import Game from './game'
import OrganisationPricingPlan from './organisation-pricing-plan'

@Entity()
export default class Organisation {
  @PrimaryKey()
  id!: number

  @Property()
  email!: string

  @Property()
  name!: string

  @OneToMany(() => Game, (game) => game.organisation)
  games = new Collection<Game>(this)

  @OneToOne({ orphanRemoval: true, eager: true })
  pricingPlan!: OrganisationPricingPlan

  @Property()
  createdAt: Date = new Date()

  @Property()
  updatedAt: Date = new Date()

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      games: this.games,
      pricingPlan: {
        status: this.pricingPlan.status,
      },
    }
  }
}
