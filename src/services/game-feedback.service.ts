import { EntityManager, QueryOrder } from '@mikro-orm/mysql'
import { HasPermission, Service, Request, Response, Validate, Routes } from 'koa-clay'
import GameFeedback from '../entities/game-feedback'
import GameFeedbackPolicy from '../policies/game-feedback.policy'
import GameFeedbackCategory from '../entities/game-feedback-category'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'

const itemsPerPage = 50

@Routes([
  {
    method: 'GET'
  },
  {
    method: 'GET',
    path: '/categories',
    handler: 'indexCategories'
  },
  {
    method: 'POST',
    path: '/categories',
    handler: 'postCategory'
  },
  {
    method: 'PUT',
    path: '/categories/:id',
    handler: 'putCategory'
  },
  {
    method: 'DELETE',
    path: '/categories/:id',
    handler: 'deleteCategory'
  }
])
export default class GameFeedbackService extends Service {
  @Validate({ query: ['page'] })
  @HasPermission(GameFeedbackPolicy, 'get')
  async index(req: Request): Promise<Response> {
    const { feedbackCategoryInternalName, search, page } = req.query
    const em: EntityManager = req.ctx.em

    let query = em.qb(GameFeedback, 'gf')
      .select('gf.*')
      .orderBy({ createdAt: QueryOrder.DESC })
      .limit(itemsPerPage)
      .offset(Number(page) * itemsPerPage)

    if (feedbackCategoryInternalName) {
      query = query
        .andWhere({
          category: {
            internalName: feedbackCategoryInternalName
          }
        })
    }

    if (search) {
      query = query.andWhere({
        $or: [
          { comment: { $like: `%${search}%` } },
          {
            $and: [
              { playerAlias: { identifier: { $like: `%${search}%` } } },
              { anonymised: false }
            ]
          }
        ]
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

  @Validate({
    body: [GameFeedbackCategory]
  })
  @HasPermission(GameFeedbackPolicy, 'putCategory')
  async putCategory(req: Request): Promise<Response> {
    const em: EntityManager = req.ctx.em

    const feedbackCategory: GameFeedbackCategory = req.ctx.state.feedbackCategory

    const updateableKeys: (keyof GameFeedbackCategory)[] = ['name', 'description', 'anonymised']
    const changedProperties = []

    for (const key in req.body) {
      if (updateableKeys.includes(key as keyof GameFeedbackCategory)) {
        const original = feedbackCategory[key]
        feedbackCategory[key] = req.body[key]
        if (original !== feedbackCategory[key]) changedProperties.push(key)
      }
    }

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
