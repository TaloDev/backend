import { EntityManager } from '@mikro-orm/core'
import { sub } from 'date-fns'
import { Service, ServiceRequest, ServiceResponse, Validate, HasPermission, ServiceRoute } from 'koa-rest-services'
import { groupBy } from 'lodash'
import Event from '../entities/event'
import Player from '../entities/player'
import HeadlinesPolicy from '../policies/headlines.policy'

export const headlinesRoutes: ServiceRoute[] = [
  {
    method: 'GET',
    path: '/new_players',
    handler: 'newPlayers'
  },
  {
    method: 'GET',
    path: '/returning_players',
    handler: 'returningPlayers'
  },
  {
    method: 'GET',
    path: '/events',
    handler: 'events'
  },
  {
    method: 'GET',
    path: '/unique_event_submitters',
    handler: 'uniqueEventSubmitters'
  }
]

export default class HeadlinesService implements Service {
  @Validate({
    query: ['gameId']
  })
  @HasPermission(HeadlinesPolicy, 'get')
  async newPlayers(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em

    const players = await em.getRepository(Player).find({
      game: Number(gameId),
      createdAt: {
        $gte: sub(new Date(), { weeks: 1 })
      }
    })

    return {
      status: 200,
      body: {
        count: players.length
      }
    }
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(HeadlinesPolicy, 'get')
  async returningPlayers(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em

    const players = await em.getRepository(Player).find({
      game: Number(gameId),
      lastSeenAt: {
        $gte: sub(new Date(), { weeks: 1 })
      },
      createdAt: {
        $lt: sub(new Date(), { weeks: 1 })
      }
    })

    return {
      status: 200,
      body: {
        count: players.length
      }
    }
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(HeadlinesPolicy, 'get')
  async events(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({
      game: Number(gameId),
      createdAt: {
        $gte: sub(new Date(), { weeks: 1 })
      }
    })

    return {
      status: 200,
      body: {
        count: events.length
      }
    }
  }

  @Validate({
    query: ['gameId']
  })
  @HasPermission(HeadlinesPolicy, 'get')
  async uniqueEventSubmitters(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId } = req.query
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({
      game: Number(gameId),
      createdAt: {
        $gte: sub(new Date(), { weeks: 1 })
      }
    }, ['playerAlias.player'])

    const count = Object.keys(groupBy(events, 'playerAlias.player.id')).length

    return {
      status: 200,
      body: {
        count
      }
    }
  }
}
