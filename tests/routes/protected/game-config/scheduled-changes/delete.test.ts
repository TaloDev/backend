import { addDays } from 'date-fns'
import request from 'supertest'
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
