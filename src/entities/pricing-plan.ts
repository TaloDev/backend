import {  Entity, PrimaryKey, Property } from '@mikro-orm/mysql'

@Entity()
export default class PricingPlan {
  @PrimaryKey()
  id!: number

  @Property()
  stripeId!: string

  @Property({ default: false })
  hidden!: boolean

  @Property({ default: false })
  default!: boolean

  @Property({ nullable: true })
  playerLimit: number | null = null

  @Property()
  createdAt: Date = new Date()

  @Property()
  updatedAt: Date = new Date()

  toJSON() {
    return {
      id: this.id,
      stripeId: this.stripeId,
      hidden: this.hidden,
      default: this.default,
      playerLimit: this.playerLimit
    }
  }
}
