import { Request, Response, Route, HasPermission, Validate } from 'koa-clay'
import { EntityManager, FilterQuery } from '@mikro-orm/mysql'
import APIService from './api-service'
import PlayerSubscriptionsAPIPolicy from '../../policies/api/player-subscriptions-api.policy'
import PlayerAliasSubscription from '../../entities/player-alias-subscription'
import PlayerAlias from '../../entities/player-alias'
import PlayerSubscriptionsAPIDocs from '../../docs/player-subscriptions-api.docs'
import { pageValidation } from '../../lib/pagination/pageValidation'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination/itemsPerPage'

export default class PlayerSubscriptionsAPIService extends APIService {
  @Route({
    method: 'POST',
    docs: PlayerSubscriptionsAPIDocs.post
  })
  @HasPermission(PlayerSubscriptionsAPIPolicy, 'post')
  @Validate({
    body: ['aliasId']
  })
  async post(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const { aliasId } = req.body
    const currentAlias = req.ctx.state.currentAlias

    if (typeof aliasId !== 'number') {
      req.ctx.throw(400, 'aliasId must be a number')
    }

    const subscribedTo = await em.repo(PlayerAlias).findOne({
      id: aliasId,
      player: {
        game: req.ctx.state.key.game
      }
    })

    if (!subscribedTo) {
      req.ctx.throw(404, 'Player alias for subscription not found')
    }

    if (currentAlias.id === subscribedTo.id) {
      req.ctx.throw(400, 'Cannot subscribe to yourself')
    }

    const existing = await em.repo(PlayerAliasSubscription).findOne({
      subscriber: currentAlias,
      subscribedTo
    })

    if (existing) {
      req.ctx.throw(400, 'Subscription already exists')
    }

    const subscription = new PlayerAliasSubscription(currentAlias, subscribedTo)
    await em.persistAndFlush(subscription)

    return {
      status: 200,
      body: {
        subscription
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/:id/confirm',
    docs: PlayerSubscriptionsAPIDocs.confirm
  })
  @HasPermission(PlayerSubscriptionsAPIPolicy, 'confirm')
  async confirm(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const { id } = req.params
    const currentAlias = req.ctx.state.currentAlias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id,
      subscribedTo: currentAlias,
      confirmed: false
    }, { populate: ['subscriber', 'subscribedTo'] })

    if (!subscription) {
      req.ctx.throw(404, 'Subscription request not found')
    }

    subscription.confirmed = true
    await em.flush()

    return {
      status: 200,
      body: {
        subscription
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/subscribers',
    docs: PlayerSubscriptionsAPIDocs.getSubscribers
  })
  @Validate({
    query: {
      page: pageValidation
    }
  })
  @HasPermission(PlayerSubscriptionsAPIPolicy, 'getSubscribers')
  async getSubscribers(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE

    const em: EntityManager = req.ctx.em
    const currentAlias = req.ctx.state.currentAlias
    const { confirmed, aliasId, page = 0 } = req.query

    if (confirmed !== undefined && confirmed !== 'true' && confirmed !== 'false') {
      req.ctx.throw(400, 'confirmed must be either true or false')
    }

    if (aliasId && isNaN(Number(aliasId))) {
      req.ctx.throw(400, 'aliasId must be a number')
    }

    const where: FilterQuery<PlayerAliasSubscription> = {
      subscribedTo: currentAlias
    }

    if (confirmed !== undefined) {
      where.confirmed = confirmed === 'true'
    }

    if (aliasId) {
      where.subscriber = Number(aliasId)
    }

    const [subscriptions, count] = await em.repo(PlayerAliasSubscription).findAndCount(where, {
      populate: ['subscriber'],
      limit: itemsPerPage + 1,
      offset: Number(page) * itemsPerPage
    })

    return {
      status: 200,
      body: {
        subscribers: subscriptions.slice(0, itemsPerPage).map((s) => s.subscriber),
        count,
        itemsPerPage,
        isLastPage: subscriptions.length <= itemsPerPage
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/subscriptions',
    docs: PlayerSubscriptionsAPIDocs.getSubscriptions
  })
  @Validate({
    query: {
      page: pageValidation
    }
  })
  @HasPermission(PlayerSubscriptionsAPIPolicy, 'getSubscriptions')
  async getSubscriptions(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE

    const em: EntityManager = req.ctx.em
    const currentAlias = req.ctx.state.currentAlias
    const { confirmed, aliasId, page = 0 } = req.query

    if (confirmed !== undefined && confirmed !== 'true' && confirmed !== 'false') {
      req.ctx.throw(400, 'confirmed must be either true or false')
    }

    if (aliasId && isNaN(Number(aliasId))) {
      req.ctx.throw(400, 'aliasId must be a number')
    }

    const where: FilterQuery<PlayerAliasSubscription> = {
      subscriber: currentAlias
    }

    if (confirmed !== undefined) {
      where.confirmed = confirmed === 'true'
    }

    if (aliasId) {
      where.subscribedTo = Number(aliasId)
    }

    const [subscriptions, count] = await em.repo(PlayerAliasSubscription).findAndCount(where, {
      populate: ['subscribedTo'],
      limit: itemsPerPage + 1,
      offset: Number(page) * itemsPerPage
    })

    return {
      status: 200,
      body: {
        subscriptions: subscriptions.slice(0, itemsPerPage).map((s) => s.subscribedTo),
        count,
        itemsPerPage,
        isLastPage: subscriptions.length <= itemsPerPage
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/:id',
    docs: PlayerSubscriptionsAPIDocs.delete
  })
  @HasPermission(PlayerSubscriptionsAPIPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const { id } = req.params
    const currentAlias = req.ctx.state.currentAlias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id,
      subscriber: currentAlias
    })

    if (!subscription) {
      req.ctx.throw(404, 'Subscription not found')
    }

    await em.removeAndFlush(subscription)

    return {
      status: 204
    }
  }
}
