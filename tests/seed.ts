import 'dotenv/config'
import { MikroORM } from '@mikro-orm/mysql'
import UserFactory from './fixtures/UserFactory.js'
import GameFactory from './fixtures/GameFactory.js'
import PlayerFactory from './fixtures/PlayerFactory.js'
import EventFactory from './fixtures/EventFactory.js'
import OrganisationFactory from './fixtures/OrganisationFactory.js'
import LeaderboardFactory from './fixtures/LeaderboardFactory.js'
import GameSaveFactory from './fixtures/GameSaveFactory.js'
import GameStatFactory from './fixtures/GameStatFactory.js'
import PlayerGameStatFactory from './fixtures/PlayerGameStatFactory.js'
import casual from 'casual'
import PricingPlanFactory from './fixtures/PricingPlanFactory.js'
import PricingPlanActionFactory from './fixtures/PricingPlanActionFactory.js'
import PricingPlanAction, { PricingPlanActionType } from '../src/entities/pricing-plan-action.js'
import OrganisationPricingPlanFactory from './fixtures/OrganisationPricingPlanFactory.js'
import PricingPlan from '../src/entities/pricing-plan.js'
import APIKey, { APIKeyScope } from '../src/entities/api-key.js'

(async () => {
  const orm = await MikroORM.init()
  await orm.getSchemaGenerator().dropSchema()
  await orm.em.getConnection().execute('drop table if exists mikro_orm_migrations')
  await orm.getMigrator().up()

  const plansMap: Partial<PricingPlan>[] = [
    { stripeId: 'prod_LcO5U04wEGWgMP' },
    { stripeId: 'prod_LbW295xhmo2bk0' },
    { stripeId: 'prod_LcNy4ow2VoJ8kc' }
  ]

  const pricingPlans = await new PricingPlanFactory().with((_, idx) => ({
    ...plansMap[idx],
    default: idx === 0
  })).many(3)

  const pricingPlanActions: PricingPlanAction[] = []

  let idx = 0
  for (const plan of pricingPlans) {
    const pricingPlanActionFactory = new PricingPlanActionFactory()

    for (const actionType of [PricingPlanActionType.USER_INVITE, PricingPlanActionType.DATA_EXPORT]) {
      const pricingPlanAction = await pricingPlanActionFactory.with(() => ({
        type: actionType,
        limit: casual.integer(idx + 1, idx * 4 + 3),
        pricingPlan: plan
      })).one()

      pricingPlanActions.push(pricingPlanAction)
    }

    idx++
  }

  const organisation = await new OrganisationFactory().with(async (organisation) => {
    const orgPlan = await new OrganisationPricingPlanFactory()
      .construct(organisation, pricingPlans[0])
      .with(() => ({ stripeCustomerId: null, stripePriceId: null }))
      .one()

    return {
      name: process.env.DEMO_ORGANISATION_NAME,
      pricingPlan: orgPlan
    }
  }).one()

  const userFactory = new UserFactory()

  const ownerUser = await userFactory.state('loginable').state('owner').with(() => ({
    organisation,
    email: 'owner@trytalo.com'
  })).one()

  const adminUser = await userFactory.state('loginable').state('admin').with(() => ({
    organisation,
    email: 'admin@trytalo.com'
  })).one()

  const devUser = await userFactory.state('loginable').with(() => ({
    organisation,
    email: 'dev@trytalo.com'
  })).one()

  const games = await new GameFactory(organisation).many(2)

  const apiKeys = games.map((game) => {
    const apiKey = new APIKey(game, ownerUser)
    apiKey.scopes = [APIKeyScope.FULL_ACCESS]
    return apiKey
  })

  const players = await new PlayerFactory(games).many(50)

  const eventsThisMonth = await new EventFactory(players).state('this month').many(300)

  const leaderboards = await new LeaderboardFactory(games).state('with entries').many(6)

  const gameSaves = await new GameSaveFactory(players).many(10)

  const gameStats = await new GameStatFactory(games).many(10)

  const playerGameStats = []
  for (const gameStat of gameStats) {
    if (!gameStat.global) {
      const player = casual.random_element(players.filter((player) => player.game === gameStat.game))
      const playerGameStat = await new PlayerGameStatFactory().construct(player, gameStat).one()
      playerGameStats.push(playerGameStat)
    }
  }

  const em = orm.em.fork()

  await em.persistAndFlush([
    ...pricingPlans,
    ...pricingPlanActions,
    ownerUser,
    adminUser,
    devUser,
    organisation,
    ...games,
    ...apiKeys,
    ...players,
    ...eventsThisMonth,
    ...leaderboards,
    ...gameSaves,
    ...gameStats,
    ...playerGameStats
  ])

  await orm.close(true)
})()
