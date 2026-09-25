import { addDays, subMinutes } from 'date-fns'
import { APIKeyScope } from '../../src/entities/api-key.js'
import GameActivity, { GameActivityType } from '../../src/entities/game-activity.js'
import Prop from '../../src/entities/prop.js'
import ScheduledGameConfigChange from '../../src/entities/scheduled-game-config-change.js'
import { setSocketInstance } from '../../src/socket/socketRegistry.js'
import { applyScheduledGameConfigChanges } from '../../src/tasks/applyScheduledGameConfigChanges.js'
import createOrganisationAndGame from '../utils/createOrganisationAndGame.js'
import createSocketIdentifyMessage from '../utils/createSocketIdentifyMessage.js'
import createTestSocket from '../utils/createTestSocket.js'
import createUserAndToken from '../utils/createUserAndToken.js'

describe('applyScheduledGameConfigChanges', () => {
  it('should apply due changes and leave future ones pending', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', '2', subMinutes(new Date(), 1)),
        new ScheduledGameConfigChange(game, user, 'maxLevel', '80', addDays(new Date(), 1)),
      ])
      .flush()

    await applyScheduledGameConfigChanges()

    const refreshedGame = await em.refreshOrFail(game)
    expect(refreshedGame.getLiveConfig()).toEqual([{ key: 'xpRate', value: '2' }])
    expect(await em.repo(ScheduledGameConfigChange).count({ game })).toBe(1)
  })

  it('should settle multiple changes to the same key on the latest one', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', '2', subMinutes(new Date(), 2)),
        new ScheduledGameConfigChange(game, user, 'xpRate', '3', subMinutes(new Date(), 1)),
      ])
      .flush()

    await applyScheduledGameConfigChanges()

    const refreshedGame = await em.refreshOrFail(game)
    expect(refreshedGame.getLiveConfig()).toEqual([{ key: 'xpRate', value: '3' }])
  })

  it('should delete a key when the value is null', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', null, subMinutes(new Date(), 1)),
      ])
      .flush()

    await applyScheduledGameConfigChanges()

    const refreshedGame = await em.refreshOrFail(game)
    expect(refreshedGame.getLiveConfig()).toEqual([])
  })

  it('should log a GAME_PROPS_UPDATED activity from the original actor', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', '2', subMinutes(new Date(), 1)),
      ])
      .flush()

    await applyScheduledGameConfigChanges()

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.GAME_PROPS_UPDATED,
    })

    expect(activity?.extra.display).toStrictEqual({ 'Updated props': 'xpRate: 2' })
  })

  it('should skip changes that fail validation', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(
          game,
          user,
          'bio',
          'a'.repeat(4097),
          subMinutes(new Date(), 1),
        ),
      ])
      .flush()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await applyScheduledGameConfigChanges()

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping scheduled game config change'),
    )
    warn.mockRestore()

    const activity = await em.repo(GameActivity).findOne(
      {
        game,
        type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_SKIPPED,
      },
      { populate: ['user'] },
    )
    expect(activity?.user?.id).toBe(user.id)
    expect(activity?.extra.display).toStrictEqual({
      'Skipped prop': `bio: ${'a'.repeat(4097)}`,
      Reason: 'Prop value length (4097) exceeds 4096 characters',
    })

    expect(await em.repo(ScheduledGameConfigChange).count({ game })).toBe(0)

    const refreshedGame = await em.refreshOrFail(game)
    expect(refreshedGame.getLiveConfig()).toEqual([{ key: 'xpRate', value: '1' }])
  })

  it('should describe a skipped deletion', async () => {
    // a null change is always valid on its own, so it only gets skipped because
    // the merged config still contains the invalid legacy prop
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('legacy', 'a'.repeat(4097))] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([
        new ScheduledGameConfigChange(game, user, 'xpRate', null, subMinutes(new Date(), 1)),
      ])
      .flush()

    await applyScheduledGameConfigChanges()

    const activity = await em.repo(GameActivity).findOne({
      game,
      type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_SKIPPED,
    })
    expect(activity?.extra.display).toStrictEqual({
      'Skipped prop': 'xpRate: [deleted]',
      Reason: 'Prop value length (4097) exceeds 4096 characters',
    })
  })

  it('should notify connected clients when changes are applied', async () => {
    const { identifyMessage, ticket, apiKey } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.READ_GAME_CONFIG,
    ])

    apiKey.game.props = [new Prop('xpRate', '1')]
    await em.flush()

    await em
      .persist([
        new ScheduledGameConfigChange(
          apiKey.game,
          apiKey.createdByUser,
          'xpRate',
          '2',
          subMinutes(new Date(), 1),
        ),
      ])
      .flush()

    await createTestSocket(`/?ticket=${ticket}`, async (client, wss) => {
      await client.identify(identifyMessage)
      setSocketInstance(wss)

      await applyScheduledGameConfigChanges()

      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.live-config.updated')
        expect(actual.data.config).toStrictEqual([{ key: 'xpRate', value: '2' }])
      })
    })
  })

  it('should do nothing when no changes are due', async () => {
    const [organisation, game] = await createOrganisationAndGame(
      {},
      { props: [new Prop('xpRate', '1')] },
    )
    const [, user] = await createUserAndToken({}, organisation)

    await em
      .persist([new ScheduledGameConfigChange(game, user, 'xpRate', '2', addDays(new Date(), 1))])
      .flush()

    await applyScheduledGameConfigChanges()

    const refreshedGame = await em.refreshOrFail(game)
    expect(refreshedGame.getLiveConfig()).toEqual([{ key: 'xpRate', value: '1' }])
    expect(await em.repo(ScheduledGameConfigChange).count({ game })).toBe(1)
  })
})
