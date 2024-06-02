import { Entity, ManyToOne, OneToOne, PrimaryKey, Property, Rel } from '@mikro-orm/mysql'
import Stripe from 'stripe'
import Organisation from './organisation.js'
import PricingPlan from './pricing-plan.js'

@Entity()
export default class OrganisationPricingPlan {
  @PrimaryKey()
  id: number

  @OneToOne(() => Organisation, (organisation) => organisation.pricingPlan)
  organisation: Rel<Organisation>

  @ManyToOne(() => PricingPlan, { eager: true })
  pricingPlan: PricingPlan

  @Property({ type: 'string' })
  status: Stripe.Subscription.Status = 'active'

  @Property({ nullable: true })
  stripePriceId: string

  @Property({ nullable: true })
  stripeCustomerId: string

  @Property({ nullable: true })
  endDate: Date

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(organisation: Rel<Organisation>, pricingPlan: PricingPlan) {
    this.organisation = organisation
    this.pricingPlan = pricingPlan
  }

  toJSON() {
    return {
      pricingPlan: this.pricingPlan,
      status: this.status,
      endDate: this.endDate,
      canViewBillingPortal: Boolean(this.stripeCustomerId)
    }
  }
}
