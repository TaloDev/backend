import { EntityManager, QueryOrder } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Route } from 'koa-clay'
import GameFeedback from '../entities/game-feedback'
import GameFeedbackPolicy from '../policies/game-feedback.policy'
import GameFeedbackCategory from '../entities/game-feedback-category'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import updateAllowedKeys from '../lib/entities/updateAllowedKeys'
import { TraceService } from '../lib/tracing/trace-service'

const itemsPerPage = 50

@TraceService()
export default class GameFeedbackService extends Service {
  @Route({
    method: 'GET'
  })
  @Validate({ query: ['page'] })
  @HasPermission(GameFeedbackPolicy, 'index')
  async index(req: Request): Promise<Response> {
    const { feedbackCategoryInternalName, search, page } = req.query
    const em: EntityManager = req.ctx.em

    const query = em.qb(GameFeedback, 'gf')
      .select('gf.*')
      .orderBy({ createdAt: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)

    if (feedbackCategoryInternalName) {
      query
        .andWhere({
          category: {
            internalName: feedbackCategoryInternalName
          }
        })
    }

    if (search) {
      // prop:{key}={value}
      const propSearchMatch = search.trim().match(/^prop:([^=]+)=(.+)$/)

      if (propSearchMatch) {
        const [, key, value] = propSearchMatch
        query.andWhere({
          props: {
            $some: {
              key,
              value
            }
          }
        })
      } else {
        query.andWhere({
          $or: [
            { comment: { $like: `%${search}%` } },
            {
              $and: [
                { playerAlias: { identifier: { $like: `%${search}%` } } },
                { anonymised: false }
              ]
            },
            {
              props: {
                $some: {
                  $or: [
                    { key: { $like: `%${search}%` } },
                    { value: { $like: `%${search}%` } }
                  ]
                }
              }
            }
          ]
        })
      }
    }

    if (!req.ctx.state.includeDevData) {
      query.andWhere({
        playerAlias: {
          player: {
            devBuild: false
          }
        }
      })
    }

    const [feedback, count] = await query
      .andWhere({
        category: {
          game: req.ctx.state.game
        }
      })
      .getResultAndCount()

    await em.populate(feedback, ['playerAlias'])

    return {
      status: 200,
      body: {
        feedback,
        count,
        itemsPerPage
      }
    }
  }

  @Route({
    method: 'GET',
    path: '/categories'
  })
  @HasPermission(GameFeedbackPolicy, 'indexCategories')
  async indexCategories(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const feedbackCategories = await em.getRepository(GameFeedbackCategory).find({
      game: req.ctx.state.game
    })

    return {
      status: 200,
      body: {
        feedbackCategories
      }
    }
  }

  @Route({
    method: 'POST',
    path: '/categories'
  })
  @Validate({
    body: [GameFeedbackCategory]
  })
  @HasPermission(GameFeedbackPolicy, 'postCategory')
  async postCategory(req: Request): Promise<Response> {
    const { internalName, name, description, anonymised } = req.body
    const em: EntityManager = req.ctx.em

    const feedbackCategory = new GameFeedbackCategory(req.ctx.state.game)
    feedbackCategory.internalName = internalName
    feedbackCategory.name = name
    feedbackCategory.description = description
    feedbackCategory.anonymised = anonymised

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: feedbackCategory.game,
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_CREATED,
      extra: {
        feedbackCategoryInternalName: feedbackCategory.internalName
      }
    })

    await em.persistAndFlush(feedbackCategory)

    return {
      status: 200,
      body: {
        feedbackCategory
      }
    }
  }

  @Route({
    method: 'PUT',
    path: '/categories/:id'
  })
  @Validate({
    body: [GameFeedbackCategory]
  })
  @HasPermission(GameFeedbackPolicy, 'putCategory')
  async putCategory(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const [feedbackCategory, changedProperties] = updateAllowedKeys(
      req.ctx.state.feedbackCategory as GameFeedbackCategory,
      req.body,
      ['name', 'description', 'anonymised']
    )

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: feedbackCategory.game,
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED,
      extra: {
        feedbackCategoryInternalName: feedbackCategory.internalName,
        display: {
          'Updated properties': changedProperties.map((prop) => `${prop}: ${req.body[prop]}`).join(', ')
        }
      }
    })

    await em.flush()

    return {
      status: 200,
      body: {
        feedbackCategory
      }
    }
  }

  @Route({
    method: 'DELETE',
    path: '/categories/:id'
  })
  @HasPermission(GameFeedbackPolicy, 'deleteCategory')
  async deleteCategory(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    createGameActivity(em, {
      user: req.ctx.state.user,
      game: req.ctx.state.feedbackCategory.game,
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_DELETED,
      extra: {
        feedbackCategoryInternalName: req.ctx.state.feedbackCategory.internalName
      }
    })

    await em.removeAndFlush(req.ctx.state.feedbackCategory)

    return {
      status: 204
    }
  }
}
