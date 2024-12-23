import 'dotenv/config'
import { MikroORM } from '@mikro-orm/mysql'
import UserFactory from './fixtures/UserFactory'
import GameFactory from './fixtures/GameFactory'
import PlayerFactory from './fixtures/PlayerFactory'
import EventFactory from './fixtures/EventFactory'
import OrganisationFactory from './fixtures/OrganisationFactory'
import LeaderboardFactory from './fixtures/LeaderboardFactory'
import GameSaveFactory from './fixtures/GameSaveFactory'
import GameStatFactory from './fixtures/GameStatFactory'
import PlayerGameStatFactory from './fixtures/PlayerGameStatFactory'
import PricingPlanFactory from './fixtures/PricingPlanFactory'
import PricingPlanActionFactory from './fixtures/PricingPlanActionFactory'
import PricingPlanAction, { PricingPlanActionType } from '../src/entities/pricing-plan-action'
import OrganisationPricingPlanFactory from './fixtures/OrganisationPricingPlanFactory'
import PricingPlan from '../src/entities/pricing-plan'
import APIKey, { APIKeyScope } from '../src/entities/api-key'
import GameFeedbackCategoryFactory from './fixtures/GameFeedbackCategoryFactory'
import GameFeedbackFactory from './fixtures/GameFeedbackFactory'
import createClickhouseClient from '../src/lib/clickhouse/createClient'
import { rand, randNumber } from '@ngneat/falso'

(async () => {
  console.info('Running migrations...')

  const orm = await MikroORM.init()
  await orm.getSchemaGenerator().dropSchema()
  await orm.em.getConnection().execute('drop table if exists mikro_orm_migrations')
  await orm.getMigrator().up()

  console.info('Seeding DB...')

  const plansMap: Partial<PricingPlan>[] = [
    { stripeId: 'prod_LcO5U04wEGWgMP', default: true },
    { stripeId: 'prod_LbW295xhmo2bk0', default: false },
    { stripeId: 'prod_LcNy4ow2VoJ8kc', default: false }
  ]

  const pricingPlans = await new PricingPlanFactory().state((_, idx) => plansMap[idx]).many(3)

  const pricingPlanActions: PricingPlanAction[] = []

  let idx = 0
  for (const plan of pricingPlans) {
    const pricingPlanActionFactory = new PricingPlanActionFactory()

    for (const actionType of [PricingPlanActionType.USER_INVITE, PricingPlanActionType.DATA_EXPORT]) {
      const pricingPlanAction = await pricingPlanActionFactory.state(() => ({
        type: actionType,
        limit: randNumber({ min: idx + 1, max: idx * 4 + 3 }),
        pricingPlan: plan
      })).one()

      pricingPlanActions.push(pricingPlanAction)
    }

    idx++
  }

  const organisation = await new OrganisationFactory().state(async (organisation) => {
    const orgPlan = await new OrganisationPricingPlanFactory()
      .state(() => ({
        organisation,
        pricingPlan: pricingPlans[0],
        stripeCustomerId: null,
        stripePriceId: null
      }))
      .one()

    return {
      name: process.env.DEMO_ORGANISATION_NAME,
      pricingPlan: orgPlan
    }
  }).one()

  const userFactory = new UserFactory()

  const ownerUser = await userFactory.loginable().owner().state(() => ({
    organisation,
    email: 'owner@trytalo.com'
  })).one()

  const adminUser = await userFactory.loginable().admin().state(() => ({
    organisation,
    email: 'admin@trytalo.com'
  })).one()

  const devUser = await userFactory.loginable().state(() => ({
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

  const leaderboards = await new LeaderboardFactory(games).withEntries().many(6)

  const gameSaves = await new GameSaveFactory(players).many(10)

  const gameStats = await new GameStatFactory(games).many(10)

  const playerGameStats = []
  for (const gameStat of gameStats) {
    if (!gameStat.global) {
      const player = rand(players.filter((player) => player.game === gameStat.game))
      const playerGameStat = await new PlayerGameStatFactory().construct(player, gameStat).one()
      playerGameStats.push(playerGameStat)
    }
  }

  const feedback = []
  for (const game of games) {
    const categories = [
      await new GameFeedbackCategoryFactory(game).state(() => ({ internalName: 'bugs', name: 'Bugs', anonymised: false })).one(),
      await new GameFeedbackCategoryFactory(game).state(() => ({ internalName: 'feedback', name: 'Feedback', anonymised: true })).one()
    ]

    for (const category of categories) {
      const items = await new GameFeedbackFactory(game).state(() => ({
        category,
        playerAlias: rand(players.filter((player) => player.game === game)).aliases[0],
        anonymised: category.anonymised
      })).many(5)
      feedback.push(...items)
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
    ...leaderboards,
    ...gameSaves,
    ...gameStats,
    ...playerGameStats,
    ...feedback
  ])

  await orm.close(true)

  const eventsThisMonth = await new EventFactory(players).thisMonth().many(300)

  console.info('Seeding ClickHouse...')

  const clickhouse = createClickhouseClient()
  await clickhouse.insert({
    table: 'events',
    values: eventsThisMonth.map((event) => event.getInsertableData()),
    format: 'JSONEachRow'
  })
  await clickhouse.close()

  console.info('Done!')
})()
