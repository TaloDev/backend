import { EntityManager, MikroORM } from '@mikro-orm/mysql'
import { HasPermission, Request, Response, Route, Service, Validate } from 'koa-clay'
import { pick } from 'lodash'
import { GameActivityType } from '../entities/game-activity'
import Integration, { IntegrationConfig, IntegrationType } from '../entities/integration'
import createGameActivity from '../lib/logging/createGameActivity'
import IntegrationPolicy from '../policies/integration.policy'
import ormConfig from '../config/mikro-orm.config'
import createQueue from '../lib/queues/createQueue'
import { Job, Queue } from 'bullmq'
import { TraceService } from '../lib/tracing/trace-service'

type SyncJob = {
  integrationId: number
  type: 'leaderboards' | 'stats'
}

type IntegrationUpdateableKeys = {
  [key in IntegrationType]: (keyof IntegrationConfig)[]
}

const configKeys: IntegrationUpdateableKeys = {
  [IntegrationType.STEAMWORKS]: ['apiKey', 'appId', 'syncLeaderboards', 'syncStats']
}

@TraceService()
export default class IntegrationService extends Service {
  queue: Queue<SyncJob>

  constructor() {
    super()

    this.queue = createQueue<SyncJob>('integration-syncing', async (job: Job<SyncJob>) => {
      const { integrationId, type } = job.data

      const orm = await MikroORM.init(ormConfig)
      const em = orm.em.fork()
      const integration = await em.getRepository(Integration).findOneOrFail(integrationId)

      if (type === 'leaderboards') {
        await integration.handleSyncLeaderboards(em)
      } else if (type === 'stats') {
        await integration.handleSyncStats(em)
      }

      await orm.close()
    })
  }

  @Route({
    method: 'GET'
  })
  @HasPermission(IntegrationPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const integrations = await em.getRepository(Integration).find({ game: req.ctx.state.game })

    return {
      status: 200,
      body: {
        integrations
      }
    }
  }

  @Route({
    method: 'POST'
  })
  @Validate({ body: [Integration] })
  @HasPermission(IntegrationPolicy, 'post')
  async post(req: Request): Promise<Response> {
    const { type, config } = req.body
    const em: EntityManager = req.ctx.em

    // todo, prevent if has one of type already

    const integration = new Integration(type, req.ctx.state.game, pick(config, configKeys[type as IntegrationType]) as IntegrationConfig)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_ADDED,
      extra: {
        integrationType: integration.type
      }
    })

    await em.persistAndFlush(integration)

    return {
      status: 200,
      body: {
        integration
      }
    }
  }

  @Route({
    method: 'PATCH',
    path: '/:id'
  })
  @Validate({ body: [Integration] })
  @HasPermission(IntegrationPolicy, 'patch')
  async patch(req: Request): Promise<Response> {
    const { config } = req.body
    const em: EntityManager = req.ctx.em

    const integration: Integration = req.ctx.state.integration
    const newConfig = pick(config, configKeys[integration.type])
    integration.updateConfig(newConfig)

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_UPDATED,
      extra: {
        integrationType: integration.type,
        display: {
          'Updated properties': Object.keys(newConfig).join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        integration
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id'
  })
  @HasPermission(IntegrationPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const integration: Integration = req.ctx.state.integration
    integration.deletedAt = new Date()

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_DELETED,
      extra: {
        integrationType: req.ctx.state.integration.type
      }
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Route({
    method: 'POST',
    path: '/:id/sync-leaderboards'
  })
  @HasPermission(IntegrationPolicy, 'syncLeaderboards')
  async syncLeaderboards(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    await this.queue.add('sync-leaderboards', { integrationId: Number(req.params.id), type: 'leaderboards' })

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_LEADERBOARDS_SYNCED
    })

    await em.flush()

    return {
      status: 204
    }
  }

  @Route({
    method: 'POST',
    path: '/:id/sync-stats'
  })
  @HasPermission(IntegrationPolicy, 'syncStats')
  async syncStats(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    await this.queue.add('sync-stats', { integrationId: Number(req.params.id), type: 'stats' })

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.game,
      type: GameActivityType.GAME_INTEGRATION_STEAMWORKS_STATS_SYNCED
    })

    await em.flush()

    return {
      status: 204
    }
  }
}
