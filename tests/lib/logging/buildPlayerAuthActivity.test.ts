import { PlayerAuthActivityType } from '../../../src/entities/player-auth-activity.js'
import { buildPlayerAuthActivity } from '../../../src/lib/logging/buildPlayerAuthActivity.js'
import PlayerFactory from '../../fixtures/PlayerFactory.js'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame.js'

describe('buildPlayerAuthActivity', () => {
  it('should not store the ip or user agent by default', async () => {
    const [, game] = await createOrganisationAndGame()
    const player = await new PlayerFactory([game]).one()

    const activity = buildPlayerAuthActivity({
      em,
      player,
      type: PlayerAuthActivityType.LOGGED_IN,
      ip: '1.2.3.4',
      userAgent: 'testybrowser',
    })

    expect(activity.extra.ip).toBeUndefined()
    expect(activity.extra.userAgent).toBeUndefined()
  })

  it('should store the ip and user agent when the game has opted in', async () => {
    const [, game] = await createOrganisationAndGame()
    game.playerAuthActivityEnrichment = true
    const player = await new PlayerFactory([game]).one()

    const activity = buildPlayerAuthActivity({
      em,
      player,
      type: PlayerAuthActivityType.LOGGED_IN,
      ip: '1.2.3.4',
      userAgent: 'testybrowser',
    })

    expect(activity.extra.ip).toBe('1.2.3.4')
    expect(activity.extra.userAgent).toBe('testybrowser')
  })

  it('should not store the ip when deleting auth, even when the game has opted in', async () => {
    const [, game] = await createOrganisationAndGame()
    game.playerAuthActivityEnrichment = true
    const player = await new PlayerFactory([game]).one()

    const activity = buildPlayerAuthActivity({
      em,
      player,
      type: PlayerAuthActivityType.DELETED_AUTH,
      ip: '1.2.3.4',
      userAgent: 'testybrowser',
    })

    expect(activity.extra.ip).toBeUndefined()
    expect(activity.extra.userAgent).toBe('testybrowser')
  })
})
