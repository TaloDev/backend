import { EntityManager } from '@mikro-orm/mysql'
import { Job, Queue } from 'bullmq'
import { Next } from 'koa'
import { getMikroORM } from '../../../config/mikro-orm.config'
import Game from '../../../entities/game'
import Integration, { IntegrationConfig, IntegrationType } from '../../../entities/integration'
import createQueue from '../../../lib/queues/createQueue'
import { ProtectedRouteContext } from '../../../lib/routing/context'

type IntegrationRouteContext = ProtectedRouteContext<{
  game: Game
  integration: Integration
}>

type IntegrationUpdateableKeys = {
  [key in IntegrationType]: (keyof IntegrationConfig)[]
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

export const configKeys: IntegrationUpdateableKeys = {
  [IntegrationType.STEAMWORKS]: ['apiKey', 'appId', 'syncLeaderboards', 'syncStats'],
}
