import { EntityManager } from '@mikro-orm/core'
import { endOfDay, isSameDay } from 'date-fns'
import { Service, ServiceRequest, ServiceResponse, Validate, HasPermission, Routes } from 'koa-rest-services'
import { groupBy } from 'lodash'
import Event from '../entities/event'
import Player from '../entities/player'
import HeadlinesPolicy from '../policies/headlines.policy'
import dateValidationSchema from '../lib/dates/dateValidationSchema'

@Routes([
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
])
export default class HeadlinesService implements Service {
  @Validate({
    query: {
      gameId: true,
      ...dateValidationSchema
    }
  })
  @HasPermission(HeadlinesPolicy, 'index')
  async newPlayers(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const players = await em.getRepository(Player).find({
      game: Number(gameId),
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
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
    query: {
      gameId: true,
      ...dateValidationSchema
    }
  })
  @HasPermission(HeadlinesPolicy, 'index')
  async returningPlayers(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    let players = await em.getRepository(Player).find({
      game: Number(gameId),
      lastSeenAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
      },
      createdAt: {
        $lt: new Date(startDate)
      }
    })

    players = players.filter((player) => !isSameDay(new Date(player.createdAt), new Date(player.lastSeenAt)))

    return {
      status: 200,
      body: {
        count: players.length
      }
    }
  }

  @Validate({
    query: {
      gameId: true,
      ...dateValidationSchema
    }
  })
  @HasPermission(HeadlinesPolicy, 'index')
  async events(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({
      game: Number(gameId),
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
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
    query: {
      gameId: true,
      ...dateValidationSchema
    }
  })
  @HasPermission(HeadlinesPolicy, 'index')
  async uniqueEventSubmitters(req: ServiceRequest): Promise<ServiceResponse> {
    const { gameId, startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const events = await em.getRepository(Event).find({
      game: Number(gameId),
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
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
