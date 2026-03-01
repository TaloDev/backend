import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'
import { UserType } from '../../../../src/entities/user'
import GameFeedbackFactory from '../../../fixtures/GameFeedbackFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import userPermissionProvider from '../../../utils/userPermissionProvider'

describe('Game feedback - toggle archived', () => {
  it.each(userPermissionProvider([UserType.ADMIN, UserType.DEV], 200))(
    'should return a %i for a %s user',
    async (statusCode, _, type) => {
      const [organisation, game] = await createOrganisationAndGame()
      const [token] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

      const feedback = await new GameFeedbackFactory(game).one()
      await em.persist(feedback).flush()

      await request(app)
        .patch(`/games/${game.id}/game-feedback/${feedback.id}/toggle-archived`)
        .send({ archived: true })
        .auth(token, { type: 'bearer' })
        .expect(statusCode)

      await em.refresh(feedback)

      if (statusCode === 200) {
        expect(feedback.deletedAt).not.toBeNull()
      } else {
        expect(feedback.deletedAt).toBeNull()
      }
    },
  )

  it('should not toggle archived for feedback from a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const feedback = await new GameFeedbackFactory(otherGame).one()
    await em.persist(feedback).flush()

    const res = await request(app)
      .patch(`/games/${otherGame.id}/game-feedback/${feedback.id}/toggle-archived`)
      .send({ archived: true })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not toggle archived for non-existent feedback', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}/game-feedback/99999/toggle-archived`)
      .send({ archived: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Feedback not found' })
  })

  it('should set deletedAt when archived is true', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedback = await new GameFeedbackFactory(game).one()
    await em.persist(feedback).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/game-feedback/${feedback.id}/toggle-archived`)
      .send({ archived: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback.deletedAt).not.toBeNull()
  })

  it('should clear deletedAt when archived is false', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedback = await new GameFeedbackFactory(game)
      .state(() => ({ deletedAt: new Date() }))
      .one()
    await em.persist(feedback).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/game-feedback/${feedback.id}/toggle-archived`)
      .send({ archived: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedback.deletedAt).toBeNull()
  })

  it('should create a GAME_FEEDBACK_ARCHIVED activity with the player identifier when archived is true', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedback = await new GameFeedbackFactory(game).state(() => ({ anonymised: false })).one()
    await em.persist(feedback).flush()

    await request(app)
      .patch(`/games/${game.id}/game-feedback/${feedback.id}/toggle-archived`)
      .send({ archived: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_ARCHIVED,
      game,
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.aliasIdentifier).toBe(feedback.playerAlias.identifier)
  })

  it('should set aliasIdentifier to null in the activity when the feedback is anonymised', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedback = await new GameFeedbackFactory(game).state(() => ({ anonymised: true })).one()
    await em.persist(feedback).flush()

    await request(app)
      .patch(`/games/${game.id}/game-feedback/${feedback.id}/toggle-archived`)
      .send({ archived: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_ARCHIVED,
      game,
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.aliasIdentifier).toBeNull()
  })

  it('should create a GAME_FEEDBACK_RESTORED activity with the player identifier when archived is false', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const feedback = await new GameFeedbackFactory(game)
      .state(() => ({ deletedAt: new Date(), anonymised: false }))
      .one()
    await em.persist(feedback).flush()

    await request(app)
      .patch(`/games/${game.id}/game-feedback/${feedback.id}/toggle-archived`)
      .send({ archived: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_RESTORED,
      game,
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.aliasIdentifier).toBe(feedback.playerAlias.identifier)
  })
})
