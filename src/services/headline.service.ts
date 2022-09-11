import { FilterQuery } from '@mikro-orm/core'
import { endOfDay, isSameDay } from 'date-fns'
import { Service, Request, Response, Validate, HasPermission, Routes } from 'koa-clay'
import groupBy from 'lodash.groupby'
import Event from '../entities/event'
import Player from '../entities/player'
import HeadlinePolicy from '../policies/headline.policy'
import dateValidationSchema from '../lib/dates/dateValidationSchema'
import { devDataPlayerFilter } from '../middlewares/dev-data-middleware'
import { EntityManager } from '@mikro-orm/mysql'

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
export default class HeadlineService extends Service {
  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async newPlayers(req: Request): Promise<Response> {
    const { startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    let where: FilterQuery<Player> = {
      game: req.ctx.state.game,
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
      }
    }

    if (!req.ctx.state.includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    const players = await em.getRepository(Player).find(where)

    return {
      status: 200,
      body: {
        count: players.length
      }
    }
  }

  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async returningPlayers(req: Request): Promise<Response> {
    const { startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    let where: FilterQuery<Player> = {
      game: req.ctx.state.game,
      lastSeenAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
      },
      createdAt: {
        $lt: new Date(startDate)
      }
    }

    if (!req.ctx.state.includeDevData) {
      where = Object.assign(where, devDataPlayerFilter(em))
    }

    let players = await em.getRepository(Player).find(where)
    players = players.filter((player) => !isSameDay(new Date(player.createdAt), new Date(player.lastSeenAt)))

    return {
      status: 200,
      body: {
        count: players.length
      }
    }
  }

  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async events(req: Request): Promise<Response> {
    const { startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const where: FilterQuery<Event> = {
      game: req.ctx.state.game,
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
      }
    }

    if (!req.ctx.state.includeDevData) {
      where.playerAlias = {
        player: devDataPlayerFilter(em)
      }
    }

    const events = await em.getRepository(Event).find(where)

    return {
      status: 200,
      body: {
        count: events.length
      }
    }
  }

  @Validate({ query: dateValidationSchema })
  @HasPermission(HeadlinePolicy, 'index')
  async uniqueEventSubmitters(req: Request): Promise<Response> {
    const { startDate, endDate } = req.query
    const em: EntityManager = req.ctx.em

    const where: FilterQuery<Event> = {
      game: req.ctx.state.game,
      createdAt: {
        $gte: new Date(startDate),
        $lte: endOfDay(new Date(endDate))
      }
    }

    if (!req.ctx.state.includeDevData) {
      where.playerAlias = {
        player: devDataPlayerFilter(em)
      }
    }

    const events = await em.getRepository(Event).find(where, {
      populate: ['playerAlias.player']
    })

    const count = Object.keys(groupBy(events, 'playerAlias.player.id')).length

    return {
      status: 200,
      body: {
        count
      }
    }
  }
}
