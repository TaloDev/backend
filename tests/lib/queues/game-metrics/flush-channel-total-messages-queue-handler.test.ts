import { EntityManager } from '@mikro-orm/mysql'
import Redis from 'ioredis'
import {
  flush,
  incrementChannelTotalMessages,
} from '../../../../src/lib/queues/game-metrics/flush-channel-total-messages-queue-handler'
import GameChannelFactory from '../../../fixtures/GameChannelFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('FlushChannelTotalMessages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('incrementChannelTotalMessages', () => {
    it('should increment the redis counter for the channel', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel = await new GameChannelFactory(game).one()
      await em.persist(channel).flush()

      await incrementChannelTotalMessages(channel.id)
      await incrementChannelTotalMessages(channel.id)
      await incrementChannelTotalMessages(channel.id)

      const value = await redis.hget('channel:total-messages', String(channel.id))
      expect(value).toBe('3')
    })

    it('should track different channels independently', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel1 = await new GameChannelFactory(game).one()
      const channel2 = await new GameChannelFactory(game).one()
      await em.persist([channel1, channel2]).flush()

      await incrementChannelTotalMessages(channel1.id)
      await incrementChannelTotalMessages(channel1.id)
      await incrementChannelTotalMessages(channel2.id)

      const [value1, value2] = await Promise.all([
        redis.hget('channel:total-messages', String(channel1.id)),
        redis.hget('channel:total-messages', String(channel2.id)),
      ])

      expect(value1).toBe('2')
      expect(value2).toBe('1')
    })

    it('should not throw if redis fails', async () => {
      vi.spyOn(Redis.prototype, 'hincrby').mockRejectedValueOnce(new Error('Redis down'))

      const [, game] = await createOrganisationAndGame()
      const channel = await new GameChannelFactory(game).one()
      await em.persist(channel).flush()

      await expect(incrementChannelTotalMessages(channel.id)).resolves.not.toThrow()
    })
  })

  describe('flush', () => {
    it('should do nothing when there are no buffered items', async () => {
      await expect(flush()).resolves.not.toThrow()
    })

    it('should write buffered increments to the database', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel = await new GameChannelFactory(game).one()
      await em.persist(channel).flush()

      await redis.hset('channel:total-messages', String(channel.id), '5')
      await flush()

      const updated = await em.refreshOrFail(channel)
      expect(updated.totalMessages).toBe(5)

      const remaining = await redis.hget('channel:total-messages', String(channel.id))
      expect(remaining).toBeNull()
    })

    it('should accumulate on top of existing totalMessages', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel = await new GameChannelFactory(game).one()
      channel.totalMessages = 10
      await em.persist(channel).flush()

      await redis.hset('channel:total-messages', String(channel.id), '3')
      await flush()

      const updated = await em.refreshOrFail(channel)
      expect(updated.totalMessages).toBe(13)
    })

    it('should flush multiple channels in one pass', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel1 = await new GameChannelFactory(game).one()
      const channel2 = await new GameChannelFactory(game).one()
      await em.persist([channel1, channel2]).flush()

      await redis.hset('channel:total-messages', String(channel1.id), '4', String(channel2.id), '7')
      await flush()

      const [updated1, updated2] = await Promise.all([
        em.refreshOrFail(channel1),
        em.refreshOrFail(channel2),
      ])

      expect(updated1.totalMessages).toBe(4)
      expect(updated2.totalMessages).toBe(7)
    })

    it('should continue flushing remaining channels if one update fails', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel1 = await new GameChannelFactory(game).one()
      const channel2 = await new GameChannelFactory(game).one()
      await em.persist([channel1, channel2]).flush()

      await redis.hset('channel:total-messages', String(channel1.id), '3', String(channel2.id), '5')

      vi.spyOn(EntityManager.prototype, 'qb').mockImplementationOnce(() => {
        throw new Error('DB error')
      })

      await expect(flush()).resolves.not.toThrow()

      const [updated1, updated2] = await Promise.all([
        em.refreshOrFail(channel1),
        em.refreshOrFail(channel2),
      ])

      const totalUpdated = [updated1.totalMessages, updated2.totalMessages].filter(
        (v) => v > 0,
      ).length
      expect(totalUpdated).toBe(1)
    })

    it('should skip entries with a zero increment', async () => {
      const [, game] = await createOrganisationAndGame()
      const channel = await new GameChannelFactory(game).one()
      await em.persist(channel).flush()

      await redis.hset('channel:total-messages', String(channel.id), '0')
      await flush()

      const updated = await em.refreshOrFail(channel)
      expect(updated.totalMessages).toBe(0)
    })
  })
})
