import { Entity, ManyToOne, OneToOne, PrimaryKey, Property } from '@mikro-orm/core'
import Stripe from 'stripe'
import Organisation from './organisation'
import PricingPlan from './pricing-plan'

@Entity()
export default class OrganisationPricingPlan {
  @PrimaryKey()
  id: number

  @OneToOne(() => Organisation, (organisation) => organisation.pricingPlan)
  organisation: Organisation

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

  constructor(organisation: Organisation, pricingPlan: PricingPlan) {
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
