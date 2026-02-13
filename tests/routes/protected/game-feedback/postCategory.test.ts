import request from 'supertest'
import createUserAndToken from '../../../utils/createUserAndToken'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import GameFeedbackCategoryFactory from '../../../fixtures/GameFeedbackCategoryFactory'
import userPermissionProvider from '../../../utils/userPermissionProvider'
import { UserType } from '../../../../src/entities/user'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity'

describe('Game feedback service - post category', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN,
    UserType.DEV
  ]))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type }, organisation)

    const res = await request(app)
      .post(`/games/${game.id}/game-feedback/categories`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    const activity = await em.getRepository(GameActivity).findOne({
      type: GameActivityType.GAME_FEEDBACK_CATEGORY_CREATED,
      game
    })

    if (statusCode === 200) {
      expect(res.body.feedbackCategory.internalName).toBe('bugs')
      expect(res.body.feedbackCategory.name).toBe('Bugs')
      expect(res.body.feedbackCategory.description).toBe('Bug reports')
      expect(res.body.feedbackCategory.anonymised).toBe(false)

      expect(activity!.extra.feedbackCategoryInternalName).toBe(res.body.feedbackCategory.internalName)
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to create feedback categories' })

      expect(activity).toBeNull()
    }
  })

  it('should not create a feedback category for a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post(`/games/${otherGame.id}/game-feedback/categories`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not create a feedback category for a non-existent game', async () => {
    const [token] = await createUserAndToken()

    const res = await request(app)
      .post('/games/999999999/game-feedback/categories')
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Game not found' })
  })

  it('should not create a feedback category with a duplicate internal name', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const category = await new GameFeedbackCategoryFactory(game).state(() => ({ internalName: 'bugs' })).one()
    await em.persistAndFlush(category)

    const res = await request(app)
      .post(`/games/${game.id}/game-feedback/categories`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(400)

    expect(res.body).toStrictEqual({
      errors: {
        internalName: ['A feedback category with the internalName \'bugs\' already exists']
      }
    })
  })

  it('should create a feedback category with a duplicate internal name for another game', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({}, organisation)

    await new GameFeedbackCategoryFactory(otherGame).state(() => ({ internalName: 'bugs' })).one()

    const res = await request(app)
      .post(`/games/${game.id}/game-feedback/categories`)
      .send({ internalName: 'bugs', name: 'Bugs', description: 'Bug reports', anonymised: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.feedbackCategory.internalName).toBe('bugs')
    expect(res.body.feedbackCategory.name).toBe('Bugs')
    expect(res.body.feedbackCategory.description).toBe('Bug reports')
    expect(res.body.feedbackCategory.anonymised).toBe(false)
  })
})
