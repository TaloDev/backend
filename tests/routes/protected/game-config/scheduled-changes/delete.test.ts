import { addDays } from 'date-fns'
import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../../src/entities/game-activity.js'
import ScheduledGameConfigChange from '../../../../../src/entities/scheduled-game-config-change.js'
import { UserType } from '../../../../../src/entities/user.js'
import createOrganisationAndGame from '../../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../../utils/createUserAndToken.js'

describe('Scheduled game config change - delete', () => {
  it('should cancel a scheduled change', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const change = new ScheduledGameConfigChange(game, user, 'xpRate', '3', addDays(new Date(), 1))
    await em.persist(change).flush()

    await request(app)
      .delete(`/games/${game.id}/game-config/scheduled-changes/${change.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    expect(await em.refresh(change)).toBeNull()

    const activity = await em.repo(GameActivity).findOne(
      {
        game,
        type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_CANCELLED,
      },
      { populate: ['user'] },
    )
    expect(activity?.user?.id).toBe(user.id)
    expect(activity?.extra.display).toStrictEqual({ 'Scheduled prop': 'xpRate: 3' })
  })

  it('should describe a cancelled deletion', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const change = new ScheduledGameConfigChange(game, user, 'xpRate', null, addDays(new Date(), 1))
    await em.persist(change).flush()

    await request(app)
      .delete(`/games/${game.id}/game-config/scheduled-changes/${change.id}`)
      .auth(token, { type: 'bearer' })
      .expect(204)

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_CANCELLED,
    })
    expect(activity?.extra.display).toStrictEqual({ 'Scheduled prop': 'xpRate: [deleted]' })
  })

  it('should return 404 for a change belonging to another game', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [, otherGame] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const change = new ScheduledGameConfigChange(
      otherGame,
      user,
      'xpRate',
      '3',
      addDays(new Date(), 1),
    )
    await em.persist(change).flush()

    await request(app)
      .delete(`/games/${game.id}/game-config/scheduled-changes/${change.id}`)
      .auth(token, { type: 'bearer' })
      .expect(404)
  })

  it('should return 403 for dev users', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.DEV }, organisation)

    await request(app)
      .delete(`/games/${game.id}/game-config/scheduled-changes/1`)
      .auth(token, { type: 'bearer' })
      .expect(403)
  })
})
