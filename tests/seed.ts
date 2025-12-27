import 'dotenv/config'
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
import OrganisationPricingPlanFactory from './fixtures/OrganisationPricingPlanFactory'
import PricingPlan from '../src/entities/pricing-plan'
import APIKey, { APIKeyScope } from '../src/entities/api-key'
import GameFeedbackCategoryFactory from './fixtures/GameFeedbackCategoryFactory'
import GameFeedbackFactory from './fixtures/GameFeedbackFactory'
import createClickHouseClient from '../src/lib/clickhouse/createClient'
import { rand } from '@ngneat/falso'
import ormConfig from '../src/config/mikro-orm.config'
import { MikroORM } from '@mikro-orm/mysql'

(async () => {
  console.info('Running migrations...')

  const seedOrmConfig: typeof ormConfig = {
    ...ormConfig,
    subscribers: []
  }

  const orm = await MikroORM.init(seedOrmConfig)
  await orm.schema.dropSchema()
  await orm.em.getConnection().execute('drop table if exists mikro_orm_migrations')
  await orm.migrator.up()

  console.info('Seeding DB...')

  const plansMap: Partial<PricingPlan>[] = [
    { stripeId: 'prod_LcO5U04wEGWgMP', playerLimit: 10000, default: true },
    { stripeId: 'prod_LbW295xhmo2bk0', playerLimit: 100000, default: false },
    { stripeId: 'prod_LcNy4ow2VoJ8kc', playerLimit: 1000000, default: false }
  ]
  const pricingPlans = await new PricingPlanFactory().state((_, idx) => plansMap[idx]).many(3)

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

  const ownerUser = await new UserFactory().loginable().owner().emailConfirmed().state(() => ({
    organisation,
    email: 'owner@trytalo.com'
  })).one()

  const adminUser = await new UserFactory().loginable().admin().emailConfirmed().state(() => ({
    organisation,
    email: 'admin@trytalo.com'
  })).one()

  const devUser = await new UserFactory().loginable().emailConfirmed().state(() => ({
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

  const clickhouse = createClickHouseClient()
  await clickhouse.insert({
    table: 'events',
    values: eventsThisMonth.map((event) => event.toInsertable()),
    format: 'JSONEachRow'
  })
  await clickhouse.insert({
    table: 'event_props',
    values: eventsThisMonth.flatMap((event) => event.getInsertableProps()),
    format: 'JSONEachRow'
  })
  await clickhouse.close()

  console.info('Done!')
})()
