import { Request, Response, Route, HasPermission, Validate } from 'koa-clay'
import { EntityManager, FilterQuery } from '@mikro-orm/mysql'
import APIService from './api-service'
import PlayerRelationshipsAPIPolicy from '../../policies/api/player-relationships-api.policy'
import PlayerAliasSubscription, { RelationshipType } from '../../entities/player-alias-subscription'
import PlayerAlias from '../../entities/player-alias'
import { PlayerRelationshipsAPIDocs } from '../../docs/player-relationships-api.docs'
import { pageValidation } from '../../lib/pagination/pageValidation'
import { DEFAULT_PAGE_SIZE } from '../../lib/pagination/itemsPerPage'
import Socket from '../../socket'
import { sendMessages } from '../../socket/messages/socketMessage'
import { APIKeyScope } from '../../entities/api-key'
import { withResponseCache } from '../../lib/perf/responseCache'

const relationshipTypeValidation = async (val: unknown) => [
  {
    check: Object.values(RelationshipType).includes(val as RelationshipType),
    error: 'relationshipType must be either "unidirectional" or "bidirectional"'
  }
]

export default class PlayerRelationshipsAPIService extends APIService {
  @Route({
    method: 'POST',
    docs: PlayerRelationshipsAPIDocs.post
  })
  @HasPermission(PlayerRelationshipsAPIPolicy, 'post')
  @Validate({
    body: {
      aliasId: {
        required: true
      },
      relationshipType: {
        required: true,
        validation: relationshipTypeValidation
      }
    }
  })
  async post(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const { aliasId, relationshipType } = req.body
    const currentAlias = req.ctx.state.currentAlias

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

    const subscription = new PlayerAliasSubscription(
      currentAlias,
      subscribedTo,
      relationshipType as RelationshipType
    )
    await em.persist(subscription).flush()

    const conns = (req.ctx.wss as Socket).findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS) &&
        conn.playerAliasId === subscribedTo.id
      )
    })
    await sendMessages(conns, 'v1.player-relationships.subscription-created', {
      subscription
    })

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
    docs: PlayerRelationshipsAPIDocs.confirm
  })
  @HasPermission(PlayerRelationshipsAPIPolicy, 'confirm')
  async confirm(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const { id } = req.params
    const currentAlias: PlayerAlias = req.ctx.state.currentAlias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id: Number(id),
      subscribedTo: currentAlias,
      confirmed: false
    })

    if (!subscription) {
      req.ctx.throw(404, 'Subscription request not found')
    }

    subscription.confirmed = true
    await em.flush()

    let reciprocalSubscription: PlayerAliasSubscription | null = null
    if (subscription.relationshipType === RelationshipType.BIDIRECTIONAL) {
      const existingReciprocal = await em.repo(PlayerAliasSubscription).findOne({
        subscriber: subscription.subscribedTo,
        subscribedTo: subscription.subscriber
      })

      if (!existingReciprocal) {
        reciprocalSubscription = new PlayerAliasSubscription(
          subscription.subscribedTo,
          subscription.subscriber,
          RelationshipType.BIDIRECTIONAL
        )
        reciprocalSubscription.confirmed = true
        await em.persist(reciprocalSubscription).flush()
      } else if (!existingReciprocal.confirmed) {
        existingReciprocal.confirmed = true
        reciprocalSubscription = existingReciprocal
        await em.flush()
      }
    }

    // only notify the original requester (subscriber) that their request was accepted
    // the person who accepted (subscribedTo) already knows they accepted it
    const subscriberConns = (req.ctx.wss as Socket).findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS) &&
        conn.playerAliasId === subscription.subscriber.id
      )
    })
    await sendMessages(subscriberConns, 'v1.player-relationships.subscription-confirmed', {
      subscription
    })

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
    docs: PlayerRelationshipsAPIDocs.getSubscribers
  })
  @Validate({
    query: {
      page: pageValidation,
      relationshipType: {
        validation: relationshipTypeValidation
      }
    }
  })
  @HasPermission(PlayerRelationshipsAPIPolicy, 'getSubscribers')
  async getSubscribers(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE

    const em: EntityManager = req.ctx.em
    const currentAlias: PlayerAlias = req.ctx.state.currentAlias
    const { confirmed, aliasId, relationshipType, page = 0 } = req.query

    const cacheKey = `${PlayerAliasSubscription.getSubscribersCacheKey(currentAlias)}-${confirmed}-${aliasId}-${relationshipType}-${page}`

    return withResponseCache({ key: cacheKey }, async () => {

      const where: FilterQuery<PlayerAliasSubscription> = {
        subscribedTo: currentAlias
      }

      if (confirmed !== undefined) {
        where.confirmed = confirmed === 'true'
      }

      if (aliasId) {
        where.subscriber = Number(aliasId)
      }

      if (relationshipType) {
        where.relationshipType = relationshipType as RelationshipType
      }

      const [subscriptions, count] = await em.repo(PlayerAliasSubscription).findAndCount(where, {
        limit: itemsPerPage + 1,
        offset: Number(page) * itemsPerPage
      })

      return {
        status: 200,
        body: {
          subscriptions: subscriptions.slice(0, itemsPerPage),
          count,
          itemsPerPage,
          isLastPage: subscriptions.length <= itemsPerPage
        }
      }
    })
  }

  @Route({
    method: 'GET',
    path: '/subscriptions',
    docs: PlayerRelationshipsAPIDocs.getSubscriptions
  })
  @Validate({
    query: {
      page: pageValidation,
      relationshipType: {
        validation: relationshipTypeValidation
      }
    }
  })
  @HasPermission(PlayerRelationshipsAPIPolicy, 'getSubscriptions')
  async getSubscriptions(req: Request): Promise<Response> {
    const itemsPerPage = DEFAULT_PAGE_SIZE

    const em: EntityManager = req.ctx.em
    const currentAlias = req.ctx.state.currentAlias
    const { confirmed, aliasId, relationshipType, page = 0 } = req.query

    const cacheKey = `${PlayerAliasSubscription.getSubscriptionsCacheKey(currentAlias)}-${confirmed}-${aliasId}-${relationshipType}-${page}`

    return withResponseCache({ key: cacheKey }, async () => {
      const where: FilterQuery<PlayerAliasSubscription> = {
        subscriber: currentAlias
      }

      if (confirmed !== undefined) {
        where.confirmed = confirmed === 'true'
      }

      if (aliasId) {
        where.subscribedTo = Number(aliasId)
      }

      if (relationshipType) {
        where.relationshipType = relationshipType as RelationshipType
      }

      const [subscriptions, count] = await em.repo(PlayerAliasSubscription).findAndCount(where, {
        limit: itemsPerPage + 1,
        offset: Number(page) * itemsPerPage
      })

      return {
        status: 200,
        body: {
          subscriptions: subscriptions.slice(0, itemsPerPage),
          count,
          itemsPerPage,
          isLastPage: subscriptions.length <= itemsPerPage
        }
      }
    })
  }

  @Route({
    method: 'DELETE',
    path: '/:id',
    docs: PlayerRelationshipsAPIDocs.delete
  })
  @HasPermission(PlayerRelationshipsAPIPolicy, 'delete')
  async delete(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em
    const { id } = req.params
    const currentAlias = req.ctx.state.currentAlias

    const subscription = await em.repo(PlayerAliasSubscription).findOne({
      id: Number(id),
      subscriber: currentAlias
    })

    if (!subscription) {
      req.ctx.throw(404, 'Subscription not found')
    }

    const subscribedToId = subscription.subscribedTo.id
    const subscriberId = subscription.subscriber.id
    const isBidirectional = subscription.relationshipType === RelationshipType.BIDIRECTIONAL

    const reciprocalSubscription = isBidirectional ? await em.repo(PlayerAliasSubscription).findOne({
      subscriber: subscription.subscribedTo,
      subscribedTo: subscription.subscriber
    }) : null

    em.remove(subscription)
    if (reciprocalSubscription) {
      em.remove(reciprocalSubscription)
    }
    await em.flush()

    // notify both parties with a single message containing both subscriptions
    const conns = (req.ctx.wss as Socket).findConnections((conn) => {
      return (
        conn.hasScope(APIKeyScope.READ_PLAYER_RELATIONSHIPS) &&
        (conn.playerAliasId === subscribedToId || conn.playerAliasId === subscriberId)
      )
    })
    await sendMessages(conns, 'v1.player-relationships.subscription-deleted', {
      subscription,
      reciprocalSubscription: reciprocalSubscription
    })

    return {
      status: 204
    }
  }
}
