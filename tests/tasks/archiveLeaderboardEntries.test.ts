import { LeaderboardRefreshInterval } from '../../src/entities/leaderboard'
import LeaderboardFactory from '../fixtures/LeaderboardFactory'
import PlayerFactory from '../fixtures/PlayerFactory'
import LeaderboardEntryFactory from '../fixtures/LeaderboardEntryFactory'
import { sub } from 'date-fns'
import IntegrationFactory from '../fixtures/IntegrationFactory'
import { IntegrationType } from '../../src/entities/integration'
import IntegrationConfigFactory from '../fixtures/IntegrationConfigFactory'
import AxiosMockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import archiveLeaderboardEntries from '../../src/tasks/archiveLeaderboardEntries'
import SteamworksLeaderboardMapping from '../../src/entities/steamworks-leaderboard-mapping'
import { randNumber } from '@ngneat/falso'
import createOrganisationAndGame from '../utils/createOrganisationAndGame'

describe('archiveLeaderboardEntries', () => {
  const axiosMock = new AxiosMockAdapter(axios)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    axiosMock.reset()
    vi.useRealTimers()
  })

  it('should archive daily entries older than today', async () => {
    const [, game] = await createOrganisationAndGame()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({
      refreshInterval: LeaderboardRefreshInterval.DAILY
    })).one()

    const player = await new PlayerFactory([game]).one()

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: sub(new Date(), { days: 2 }) }))
      .one()

    const todayEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: new Date() }))
      .one()

    await global.em.persistAndFlush([oldEntry, todayEntry])
    await archiveLeaderboardEntries()
    await global.em.refresh(oldEntry)
    await global.em.refresh(todayEntry)

    expect(oldEntry.deletedAt).toBeDefined()
    expect(todayEntry.deletedAt).toBeNull()
  })

  it('should archive weekly entries from previous weeks', async () => {
    const [, game] = await createOrganisationAndGame()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({
      refreshInterval: LeaderboardRefreshInterval.WEEKLY
    })).one()

    const player = await new PlayerFactory([game]).one()

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: sub(new Date(), { weeks: 2 }) }))
      .one()

    const thisWeekEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: new Date() }))
      .one()

    await global.em.persistAndFlush([oldEntry, thisWeekEntry])
    await archiveLeaderboardEntries()
    await global.em.refresh(oldEntry)
    await global.em.refresh(thisWeekEntry)

    expect(oldEntry.deletedAt).toBeDefined()
    expect(thisWeekEntry.deletedAt).toBeNull()
  })

  it('should archive monthly entries from previous months', async () => {
    const [, game] = await createOrganisationAndGame()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({
      refreshInterval: LeaderboardRefreshInterval.MONTHLY
    })).one()

    const player = await new PlayerFactory([game]).one()

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: sub(new Date(), { months: 2 }) }))
      .one()

    const thisMonthEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: new Date() }))
      .one()

    await global.em.persistAndFlush([oldEntry, thisMonthEntry])
    await archiveLeaderboardEntries()
    await global.em.refresh(oldEntry)
    await global.em.refresh(thisMonthEntry)

    expect(oldEntry.deletedAt).toBeDefined()
    expect(thisMonthEntry.deletedAt).toBeNull()
  })

  it('should archive yearly entries from previous years', async () => {
    const [, game] = await createOrganisationAndGame()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({
      refreshInterval: LeaderboardRefreshInterval.YEARLY
    })).one()

    const player = await new PlayerFactory([game]).one()

    const oldEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: sub(new Date(), { years: 2 }) }))
      .one()

    const thisYearEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: new Date() }))
      .one()

    await global.em.persistAndFlush([oldEntry, thisYearEntry])
    await archiveLeaderboardEntries()
    await global.em.refresh(oldEntry)
    await global.em.refresh(thisYearEntry)

    expect(oldEntry.deletedAt).toBeDefined()
    expect(thisYearEntry.deletedAt).toBeNull()
  })

  it('should trigger steamworks integration when archiving entries', async () => {
    const [, game] = await createOrganisationAndGame()

    const leaderboard = await new LeaderboardFactory([game]).state(() => ({
      refreshInterval: LeaderboardRefreshInterval.DAILY
    })).one()

    const deleteMock = vi.fn(() => [200, { result: { result: 1 } }])
    axiosMock.onPost('https://partner.steam-api.com/ISteamLeaderboards/DeleteLeaderboardScore/v1').reply(deleteMock)

    const mapping = new SteamworksLeaderboardMapping(randNumber({ min: 100_000, max: 999_999 }), leaderboard)

    const player = await new PlayerFactory([game]).withSteamAlias().one()
    const oldEntry = await new LeaderboardEntryFactory(leaderboard, [player])
      .state(() => ({ createdAt: sub(new Date(), { days: 2 }) }))
      .one()

    const config = await new IntegrationConfigFactory().state(() => ({ syncLeaderboards: true })).one()
    const integration = await new IntegrationFactory()
      .construct(IntegrationType.STEAMWORKS, game, config)
      .one()

    await global.em.persistAndFlush([integration, oldEntry, mapping])
    await archiveLeaderboardEntries()

    expect(deleteMock).toHaveBeenCalledTimes(1)
  })
})
