import request from 'supertest'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import GameFeedbackFactory from '../../fixtures/GameFeedbackFactory'
import GameFeedbackCategoryFactory from '../../fixtures/GameFeedbackCategoryFactory'
import PlayerAliasFactory from '../../fixtures/PlayerAliasFactory'
import PlayerFactory from '../../fixtures/PlayerFactory'
import { Collection } from '@mikro-orm/mysql'
import GameFeedbackProp from '../../../src/entities/game-feedback-prop'

describe('Game feedback service - index', () => {
  it('should return a list of game feedback', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const feedback = await new GameFeedbackFactory(game).many(10)
    await em.persistAndFlush(feedback)

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedback.length)
  })

  it('should return a list of game feedback for a specific category', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantCategory = await new GameFeedbackFactory(game).state(() => ({ category })).many(5)
    const feedbackWithoutRelevantCategory = await new GameFeedbackFactory(game).many(5)
    await em.persistAndFlush([...feedbackWithRelevantCategory, ...feedbackWithoutRelevantCategory])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ feedbackCategoryInternalName: category.internalName, page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantCategory.length)
  })

  it('should not return game feedback for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .get('/games/99999/game-feedback')
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not return game feedback for a game the user has no access to', async () => {
    const [, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    await new GameFeedbackFactory(game).many(10)

    await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(403)
  })

  it('should paginate results when getting feedback', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ organisation })

    const count = 82
    const feedback = await new GameFeedbackFactory(game).many(count)
    await em.persistAndFlush(feedback)

    const page = Math.floor(count / 50)

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ page })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedback.length % 50)
    expect(res.body.count).toBe(feedback.length)
    expect(res.body.itemsPerPage).toBe(50)
  })

  it('should return a list of game feedback for a specific comment', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantComment = await new GameFeedbackFactory(game).state(() => ({ category, comment: 'blah' })).many(3)
    const feedbackWithoutRelevantComment = await new GameFeedbackFactory(game).state(() => ({ comment: 'bleh' })).many(5)
    await em.persistAndFlush([...feedbackWithRelevantComment, ...feedbackWithoutRelevantComment])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ search: 'blah', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantComment.length)
  })

  it('should return a list of game feedback for a specific category and a specific comment', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantCategory = await new GameFeedbackFactory(game).state(() => ({ category })).many(10)
    const feedbackWithRelevantCategoryAndComment = await new GameFeedbackFactory(game).state(() => ({ category, comment: 'blah' })).many(3)
    const feedbackWithoutRelevantCategory = await new GameFeedbackFactory(game).state(() => ({ comment: 'blah' })).many(5)
    await em.persistAndFlush([...feedbackWithRelevantCategory, ...feedbackWithRelevantCategoryAndComment, ...feedbackWithoutRelevantCategory])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ feedbackCategoryInternalName: category.internalName, search: 'blah', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantCategoryAndComment.length)
  })

  it('should return a list of game feedback for a specific player alias', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).state(async () => ({ player, identifier: 'big_complainer_01' })).one()

    const feedbackWithRelevantAlias = await new GameFeedbackFactory(game).state(() => ({
      category,
      playerAlias,
      anonymised: false
    })).many(3)

    const feedbackWithoutRelevantAlias = await new GameFeedbackFactory(game).many(5)

    await em.persistAndFlush([...feedbackWithRelevantAlias, ...feedbackWithoutRelevantAlias])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ search: 'big_complainer_01', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantAlias.length)
  })

  it('should not return game feedback for a specific player alias if their feedback is anonymised', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).state(async () => ({ player, identifier: 'big_complainer_01' })).one()

    const feedbackWithRelevantAlias = await new GameFeedbackFactory(game).state(() => ({
      category,
      playerAlias,
      anonymised: true
    })).many(3)

    await em.persistAndFlush(feedbackWithRelevantAlias)

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ search: 'big_complainer_01', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(0)
  })

  it('should return a list of game feedback for a specific category and a specific player alias', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const player = await new PlayerFactory([game]).one()
    const playerAlias = await new PlayerAliasFactory(player).state(async () => ({ player, identifier: 'big_complainer_01' })).one()

    const feedbackWithRelevantCategory = await new GameFeedbackFactory(game).state(() => ({ category })).many(10)

    const feedbackWithRelevantCategoryAndAlias = await new GameFeedbackFactory(game).state(() => ({
      category,
      comment: 'blah',
      playerAlias,
      anonymised: false
    })).many(3)

    const feedbackWithoutRelevantCategory = await new GameFeedbackFactory(game).state(() => ({
      playerAlias,
      anonymised: false
    })).many(5)

    await em.persistAndFlush([...feedbackWithRelevantCategory, ...feedbackWithRelevantCategoryAndAlias, ...feedbackWithoutRelevantCategory])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ feedbackCategoryInternalName: category.internalName, search: 'big_complainer_01', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantCategoryAndAlias.length)
  })

  it('should not return feedback from dev build players if the dev data header is not set', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    const feedback = await new GameFeedbackFactory(game).state(() => ({ playerAlias: player.aliases[0] })).many(10)
    await em.persistAndFlush(feedback)

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(0)
  })

  it('should return a list of game feedback for a specific prop key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantPropKey = await new GameFeedbackFactory(game).state((feedback) => ({
      category,
      props: new Collection<GameFeedbackProp>(feedback, [
        new GameFeedbackProp(feedback, 'gameVersion', '0.17.0')
      ])
    })).many(3)
    const feedbackWithoutRelevantPropKey = await new GameFeedbackFactory(game).many(5)
    await em.persistAndFlush([...feedbackWithRelevantPropKey, ...feedbackWithoutRelevantPropKey])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ search: 'gameVersion', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantPropKey.length)
  })

  it('should return a list of game feedback for a specific prop value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantPropValue = await new GameFeedbackFactory(game).state((feedback) => ({
      category,
      props: new Collection<GameFeedbackProp>(feedback, [
        new GameFeedbackProp(feedback, 'gameVersion', '0.17.0')
      ])
    })).many(3)
    const feedbackWithoutRelevantPropValue = await new GameFeedbackFactory(game).many(5)
    await em.persistAndFlush([...feedbackWithRelevantPropValue, ...feedbackWithoutRelevantPropValue])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ search: '0.17.0', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantPropValue.length)
  })

  it('should return a list of game feedback for a specific prop key and value', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    const category = await new GameFeedbackCategoryFactory(game).one()

    const feedbackWithRelevantProp = await new GameFeedbackFactory(game).state((feedback) => ({
      category,
      props: new Collection<GameFeedbackProp>(feedback, [
        new GameFeedbackProp(feedback, 'gameVersion', '0.17.0')
      ])
    })).many(3)
    const feedbackWithoutRelevantProp = await new GameFeedbackFactory(game).many(5)
    await em.persistAndFlush([...feedbackWithRelevantProp, ...feedbackWithoutRelevantProp])

    const res = await request(app)
      .get(`/games/${game.id}/game-feedback`)
      .query({ search: 'prop:gameVersion=0.17.0', page: 0 })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback).toHaveLength(feedbackWithRelevantProp.length)
  })
})
