import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import GameFeedback from '../../../../src/entities/game-feedback'
import { UserType } from '../../../../src/entities/user'
import GameFeedbackCategoryFactory from '../../../fixtures/GameFeedbackCategoryFactory'
import GameFeedbackFactory from '../../../fixtures/GameFeedbackFactory'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Game feedback - reset category', () => {
  it.each(userPermissionProvider([UserType.ADMIN], 200))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

      const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()
      const feedback = await new GameFeedbackFactory(game)
        .state(() => ({ category: feedbackCategory }))
        .one()
      await em.persist([feedbackCategory, feedback]).flush()

      const res = await request(app)
        .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      if (statusCode === 200) {
        expect(res.body.deletedCount).toBe(1)
      } else {
        expect(res.body).toStrictEqual({ message: 'You do not have permissions to reset feedback' })
      }
    },
  )

  it('should reset all feedback when mode is "all"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devFeedback = await Promise.all(
      devPlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )
    const liveFeedback = await Promise.all(
      livePlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )

    await em.persist([feedbackCategory, ...devFeedback, ...liveFeedback]).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .query({ mode: 'all' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(5)

    const remaining = await em.repo(GameFeedback).find({ category: feedbackCategory })
    expect(remaining).toHaveLength(0)
  })

  it('should reset only dev player feedback when mode is "dev"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devFeedback = await Promise.all(
      devPlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )
    const liveFeedback = await Promise.all(
      livePlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )

    await em.persist([feedbackCategory, ...devFeedback, ...liveFeedback]).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .query({ mode: 'dev' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(2)

    const remaining = await em
      .repo(GameFeedback)
      .find({ category: feedbackCategory }, { populate: ['playerAlias.player'] })
    expect(remaining).toHaveLength(3)
    expect(remaining.every((f) => !f.playerAlias.player.devBuild)).toBe(true)
  })

  it('should reset only live player feedback when mode is "live"', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const livePlayers = await new PlayerFactory([game]).many(3)

    const devFeedback = await Promise.all(
      devPlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )
    const liveFeedback = await Promise.all(
      livePlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )

    await em.persist([feedbackCategory, ...devFeedback, ...liveFeedback]).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .query({ mode: 'live' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(3)

    const remaining = await em
      .repo(GameFeedback)
      .find({ category: feedbackCategory }, { populate: ['playerAlias.player'] })
    expect(remaining).toHaveLength(2)
    expect(remaining.every((f) => f.playerAlias.player.devBuild)).toBe(true)
  })

  it('should return 0 deleted count when no feedback matches the mode', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()

    const devPlayers = await new PlayerFactory([game]).devBuild().many(2)
    const devFeedback = await Promise.all(
      devPlayers.map((player) =>
        new GameFeedbackFactory(game)
          .state(() => ({ category: feedbackCategory, playerAlias: player.aliases[0] }))
          .one(),
      ),
    )

    await em.persist([feedbackCategory, ...devFeedback]).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .query({ mode: 'live' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(0)

    const remaining = await em.repo(GameFeedback).find({ category: feedbackCategory })
    expect(remaining).toHaveLength(2)
  })

  it('should create game activity with correct data', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()
    const feedback = await new GameFeedbackFactory(game)
      .state(() => ({ category: feedbackCategory }))
      .one()
    await em.persist([feedbackCategory, feedback]).flush()

    await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .query({ mode: 'dev' })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_RESET,
      game,
      user,
    })

    expect(activity).not.toBeNull()
    expect(activity!.extra).toEqual({
      feedbackCategoryInternalName: feedbackCategory.internalName,
      display: {
        'Reset mode': 'Dev players',
        'Deleted count': expect.any(Number),
      },
    })
  })

  it('should not reset feedback for a category in a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const feedbackCategory = await new GameFeedbackCategoryFactory(otherGame).one()
    const feedback = await new GameFeedbackFactory(otherGame)
      .state(() => ({ category: feedbackCategory }))
      .one()
    await em.persist([feedbackCategory, feedback]).flush()

    const res = await request(app)
      .delete(`/games/${otherGame.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })

    const remaining = await em.repo(GameFeedback).find({ category: feedbackCategory })
    expect(remaining).toHaveLength(1)
  })

  it('should not reset feedback for a non-existent category', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/99999/feedback`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Feedback category not found' })
  })

  it('should handle invalid reset mode gracefully', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedbackCategory = await new GameFeedbackCategoryFactory(game).one()
    await em.persist(feedbackCategory).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${feedbackCategory.id}/feedback`)
      .query({ mode: 'invalid' })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        mode: ['Mode must be one of: all, live, dev'],
      },
    })
  })

  it('should only reset feedback for the specified category', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const category1 = await new GameFeedbackCategoryFactory(game).one()
    const category2 = await new GameFeedbackCategoryFactory(game).one()

    const feedback1 = await new GameFeedbackFactory(game)
      .state(() => ({ category: category1 }))
      .one()
    const feedback2 = await new GameFeedbackFactory(game)
      .state(() => ({ category: category2 }))
      .one()

    await em.persist([category1, category2, feedback1, feedback2]).flush()

    const res = await request(app)
      .delete(`/games/${game.id}/game-feedback/categories/${category1.id}/feedback`)
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.deletedCount).toBe(1)

    const remainingInCategory1 = await em.repo(GameFeedback).find({ category: category1 })
    expect(remainingInCategory1).toHaveLength(0)

    const remainingInCategory2 = await em.repo(GameFeedback).find({ category: category2 })
    expect(remainingInCategory2).toHaveLength(1)
  })
})
