import request from 'supertest'
import GameActivity, { GameActivityType } from '../../../../src/entities/game-activity.js'
import { DEV_BUILD_META_KEY } from '../../../../src/entities/player.js'
import { UserType } from '../../../../src/entities/user.js'
import PlayerFactory from '../../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'
import createUserAndToken from '../../../utils/createUserAndToken.js'

describe('Player - toggle dev build', () => {
  it('should not toggle dev build for a player in a game the user has no access to', async () => {
    const [, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const player = await new PlayerFactory([otherGame]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/games/${otherGame.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: true })
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'Forbidden' })
  })

  it('should not toggle dev build for a non-existent player', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const res = await request(app)
      .patch(`/games/${game.id}/players/non-existent-id/toggle-dev-build`)
      .send({ devBuild: true })
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'Player not found' })
  })

  it('should set devBuild to true and add the META_DEV_BUILD prop when devBuild is true', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.devBuild).toBe(true)

    await em.refresh(player)
    expect(player.devBuild).toBe(true)
    expect(player.props.getItems().some((p) => p.key === DEV_BUILD_META_KEY)).toBe(true)
  })

  it('should set devBuild to false and remove the META_DEV_BUILD prop when devBuild is false', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.devBuild).toBe(false)

    await em.refresh(player)
    expect(player.devBuild).toBe(false)
    expect(player.props.getItems().some((p) => p.key === DEV_BUILD_META_KEY)).toBe(false)
  })

  it('should create a PLAYER_DEV_BUILD_TOGGLED activity when enabling dev build', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).one()
    await em.persist(player).flush()

    await request(app)
      .patch(`/games/${game.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.PLAYER_DEV_BUILD_TOGGLED,
      game,
      extra: { playerId: player.id },
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.devBuild).toBe(true)
  })

  it('should create a PLAYER_DEV_BUILD_TOGGLED activity when disabling dev build', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    await request(app)
      .patch(`/games/${game.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    const activity = await em.repo(GameActivity).findOne({
      type: GameActivityType.PLAYER_DEV_BUILD_TOGGLED,
      game,
      extra: { playerId: player.id },
    })

    expect(activity).not.toBeNull()
    expect(activity?.extra.devBuild).toBe(false)
  })

  it('should toggle dev build off for a player without the META_DEV_BUILD prop', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game])
      .state(() => ({
        devBuild: true,
      }))
      .one()
    await em.persist(player).flush()

    const res = await request(app)
      .patch(`/games/${game.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: false })
      .auth(token, { type: 'bearer' })
      .expect(200)

    expect(res.body.player.devBuild).toBe(false)

    await em.refresh(player)
    expect(player.props.getItems().some((p) => p.key === DEV_BUILD_META_KEY)).toBe(false)
  })

  it('should be idempotent when enabling dev build on a player that is already a dev build', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN }, organisation)

    const player = await new PlayerFactory([game]).devBuild().one()
    await em.persist(player).flush()

    await request(app)
      .patch(`/games/${game.id}/players/${player.id}/toggle-dev-build`)
      .send({ devBuild: true })
      .auth(token, { type: 'bearer' })
      .expect(200)

    await em.refresh(player)
    expect(player.devBuild).toBe(true)
    expect(player.props.getItems().some((p) => p.key === DEV_BUILD_META_KEY)).toBe(true)
  })
})
