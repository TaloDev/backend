import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../utils/createUserAndToken.js'
import userPermissionProvider from '../../utils/userPermissionProvider.js'
import OrganisationPricingPlanActionFactory from '../../fixtures/OrganisationPricingPlanActionFactory.js'
import { PricingPlanActionType } from '../../../src/entities/pricing-plan-action.js'
import casual from 'casual'
import { sub } from 'date-fns'
import randomDate from '../../../src/lib/dates/randomDate.js'
import PricingPlanActionFactory from '../../fixtures/PricingPlanActionFactory.js'

describe('Billing service - usage', () => {
  it.each(userPermissionProvider())('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation] = await createOrganisationAndGame({}, {})
    const [token] = await createUserAndToken({ type }, organisation)

    const invitePlanAction = await new PricingPlanActionFactory()
      .with(() => ({ pricingPlan: organisation.pricingPlan.pricingPlan, type: PricingPlanActionType.USER_INVITE }))
      .one()

    const exportPlanAction = await new PricingPlanActionFactory()
      .with(() => ({ pricingPlan: organisation.pricingPlan.pricingPlan, type: PricingPlanActionType.DATA_EXPORT }))
      .one()

    const inviteActions = await new OrganisationPricingPlanActionFactory(organisation.pricingPlan)
      .with(() => ({
        type: PricingPlanActionType.USER_INVITE,
        createdAt: randomDate(sub(new Date(), { months: 2 }), new Date())
      }))
      .many(casual.integer(1, 10))

    const exportActionsThisMonth = await new OrganisationPricingPlanActionFactory(organisation.pricingPlan)
      .with(() => ({
        type: PricingPlanActionType.DATA_EXPORT,
        createdAt: new Date()
      }))
      .many(casual.integer(1, 10))

    const exportActionsLastMonth = await new OrganisationPricingPlanActionFactory(organisation.pricingPlan)
      .with(() => ({
        type: PricingPlanActionType.DATA_EXPORT,
        createdAt: sub(new Date(), { months: 1 })
      }))
      .many(casual.integer(1, 10))

    await (<EntityManager>global.em).persistAndFlush([invitePlanAction, exportPlanAction, ...inviteActions, ...exportActionsThisMonth, ...exportActionsLastMonth])

    const res = await request(global.app)
      .get('/billing/usage')
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    if (statusCode === 200) {
      expect(res.body.usage).toStrictEqual({
        [PricingPlanActionType.USER_INVITE]: {
          limit: invitePlanAction.limit,
          used: inviteActions.length
        },
        [PricingPlanActionType.DATA_EXPORT]: {
          limit: exportPlanAction.limit,
          used: exportActionsThisMonth.length
        }
      })
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to view the organisation pricing plan usage' })
    }
  })
})
