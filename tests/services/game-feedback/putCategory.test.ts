import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import createUserAndToken from '../../utils/createUserAndToken'
import GameFeedbackCategoryFactory from '../../fixtures/GameFeedbackCategoryFactory'

describe('Game feedback service - put category', () => {
  it('should update the name and description', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).state(() => ({ anonymised: false })).one()
    await (<EntityManager>global.em).persistAndFlush(feedbackCategory)

    const res = await request(global.app)
      .put(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}`)
      .send({ internalName: feedbackCategory.internalName, name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedbackCategory.name).toBe('Bugs')
    expect(res.body.feedbackCategory.description).toBe('Bug reports')

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED,
      game,
      extra: {
        feedbackCategoryInternalName: res.body.feedbackCategory.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'name: Bugs, description: Bug reports'
    })
  })

  it('should update the anonymisation', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).state(() => ({
      name: 'Bugs',
      description: 'Bug reports',
      anonymised: true
    })).one()

    await (<EntityManager>global.em).persistAndFlush(feedbackCategory)

    const res = await request(global.app)
      .put(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}`)
      .send({ internalName: feedbackCategory.internalName, name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedbackCategory.anonymised).toBe(false)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED,
      game,
      extra: {
        feedbackCategoryInternalName: res.body.feedbackCategory.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'anonymised: false'
    })
  })

  it('should not update the internal name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).state(() => ({ anonymised: false })).one()
    await (<EntityManager>global.em).persistAndFlush(feedbackCategory)

    const res = await request(global.app)
      .put(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedbackCategory.internalName).toBe(feedbackCategory.internalName)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_UPDATED,
      game,
      extra: {
        feedbackCategoryInternalName: res.body.feedbackCategory.internalName
      }
    })

    expect(activity.extra.display).toStrictEqual({
      'Updated properties': 'name: Bugs, description: Bug reports'
    })
  })

  it('should not update a feedback category for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const res = await request(global.app)
      .put(`/games/${otherGame.id}/game-feedback/categories/1`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not update a non-existent feedback category', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const res = await request(global.app)
      .put(`/games/${game.id}/game-feedback/categories/999999`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Feedback category not found' })
  })
})
