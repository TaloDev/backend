import { EntityManager } from '@mikro-orm/mysql'
import { Job, Queue } from 'bullmq'
import { Next } from 'koa'
import { getMikroORM } from '../../../config/mikro-orm.config.js'
import Game from '../../../entities/game.js'
import Integration, {
  IntegrationConfigMap,
  IntegrationType,
} from '../../../entities/integration.js'
import createQueue from '../../../lib/queues/createQueue.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'

type IntegrationRouteContext = ProtectedRouteContext<{
  game: Game
  integration: Integration
}>

type IntegrationConfigKeys = {
  [T in IntegrationType]: (keyof IntegrationConfigMap[T])[]
}

export async function loadIntegration(ctx: IntegrationRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const integration = await em
    .repo(Integration)
    .findOne(Number(id), { populate: ['game.organisation'] })

  if (!integration) {
    return ctx.throw(404, 'Integration not found')
  }

  const userOrganisation = ctx.state.user.organisation
  if (integration.game.organisation.id !== userOrganisation.id) {
    return ctx.throw(403)
  }

  ctx.state.integration = integration
  ctx.state.game = integration.game
  await next()
}

type SyncJob = {
  integrationId: number
  type: 'leaderboards' | 'stats'
}

let integrationSyncQueue: Queue<SyncJob> | null = null

function getIntegrationSyncQueue() {
  if (!integrationSyncQueue) {
    integrationSyncQueue = createQueue<SyncJob>(
      'integration-syncing',
      async (job: Job<SyncJob>) => {
        const { integrationId, type } = job.data

        const orm = await getMikroORM()
        const em = orm.em.fork() as EntityManager
        const integration = await em.repo(Integration).findOneOrFail(integrationId)

        if (type === 'leaderboards') {
          await integration.handleSyncLeaderboards(em)
        } else if (type === 'stats') {
          await integration.handleSyncStats(em)
        }
      },
    )
  }
  return integrationSyncQueue
}

export function addLeaderboardSyncJob(integrationId: number) {
  return getIntegrationSyncQueue().add('sync', { integrationId, type: 'leaderboards' })
}

export function addStatSyncJob(integrationId: number) {
  return getIntegrationSyncQueue().add('sync', { integrationId, type: 'stats' })
}

export const configKeys: IntegrationConfigKeys = {
  [IntegrationType.STEAMWORKS]: ['apiKey', 'appId', 'syncLeaderboards', 'syncStats'],
  [IntegrationType.GOOGLE_PLAY_GAMES]: ['clientId', 'clientSecret'],
  [IntegrationType.GAME_CENTER]: ['bundleId'],
}

function getAppIdentity(config: Record<string, unknown>): {
  key: string
  value: string
} {
  if ('appId' in config) {
    return { key: 'appId', value: String(config.appId) }
  }
  if ('clientId' in config) {
    return { key: 'clientId', value: String(config.clientId) }
  }
  return { key: 'bundleId', value: String(config.bundleId) }
}

// returns the identity key (e.g. "appId") when another integration of the same
// type already points at the same external app - two integrations of the same
// type can't point at the same app, they would fight over the same remote data
export async function findDuplicateAppIdentity({
  ctx,
  type,
  config,
  ignoreId,
}: {
  ctx: ProtectedRouteContext<{ game: Game }>
  type: IntegrationType
  config: Record<string, unknown>
  ignoreId?: number
}) {
  const appIdentity = getAppIdentity(config).value

  const integrations = await ctx.em.repo(Integration).find({ type, game: ctx.state.game })
  for (const integration of integrations) {
    if (integration.id === ignoreId) {
      continue
    }

    const identity = getAppIdentity(integration.getConfig())
    if (identity.value === appIdentity) {
      return identity.key
    }
  }
  return null
}
