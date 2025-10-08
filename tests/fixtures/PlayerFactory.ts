import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import Player from '../../src/entities/player'
import PlayerAliasFactory from './PlayerAliasFactory'
import { Collection } from '@mikro-orm/mysql'
import PlayerAlias from '../../src/entities/player-alias'
import { sub } from 'date-fns'
import PlayerProp from '../../src/entities/player-prop'
import PlayerAuthFactory from './PlayerAuthFactory'
import { rand, randNumber } from '@ngneat/falso'
import PlayerPresenceFactory from './PlayerPresenceFactory'

export default class PlayerFactory extends Factory<Player> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Player)

    this.availableGames = availableGames
  }

  protected definition(): void {
    const availableProps = ['zonesExplored', 'currentArea', 'position.x', 'position.y', 'deaths', 'position.z', 'currentLevel', 'inventorySpace', 'currentHealth', 'currentMana', 'currentEnergy', 'npcKills', 'playerKills']

    this.state(async (player) => {
      const propsCount = randNumber({ max: 5 })
      const props: PlayerProp[] = Array.from({ length: propsCount }, () => {
        return new PlayerProp(player, rand(availableProps), String(randNumber({ max: 99 })))
      })

      const aliases = await new PlayerAliasFactory(player).many(randNumber({ min: 1, max: 2 }))

      return {
        aliases: new Collection<PlayerAlias>(player, aliases),
        game: rand(this.availableGames),
        props: new Collection<PlayerProp>(player, props),
        lastSeenAt: sub(new Date(), { days: randNumber({ min: 0, max: 10 }) })
      }
    })
  }

  notSeenToday(): this {
    return this.state(() => ({
      lastSeenAt: sub(new Date(), { days: randNumber({ min: 1, max: 99 }) })
    }))
  }

  notCreatedThisWeek(): this {
    return this.state(() => ({
      createdAt: sub(new Date(), { days: 8 })
    }))
  }

  notSeenThisWeek(): this {
    return this.state(() => ({
      lastSeenAt: sub(new Date(), { days: 8 })
    }))
  }

  seenThisWeek(): this {
    return this.state(() => ({
      lastSeenAt: sub(new Date(), { days: randNumber({ max: 6 }) })
    }))
  }

  createdThisWeek(): this {
    return this.state(() => ({
      lastSeenAt: sub(new Date(), { days: randNumber({ max: 6 }) }),
      createdAt: sub(new Date(), { days: randNumber({ max: 6 }) })
    }))
  }

  devBuild(): this {
    return this.state((player: Player) => {
      player.devBuild = true
      player.addProp('META_DEV_BUILD', '1')
      return player
    })
  }

  withSteamAlias(steamId?: string): this {
    return this.state(async (player: Player) => {
      const alias = await new PlayerAliasFactory(player).steam().state(() => ({
        identifier: steamId ?? randNumber({ min: 100_000, max: 1_000_000 }).toString()
      })).one()

      return {
        aliases: new Collection<PlayerAlias>(player, [alias])
      }
    })
  }

  withUsernameAlias(): this {
    return this.state(async (player: Player) => {
      const alias = await new PlayerAliasFactory(player).username().one()

      return {
        aliases: new Collection<PlayerAlias>(player, [alias])
      }
    })
  }

  withTaloAlias(): this {
    return this.state(async (player: Player) => {
      const alias = await new PlayerAliasFactory(player).talo().one()
      const auth = await new PlayerAuthFactory().one()

      return {
        aliases: new Collection<PlayerAlias>(player, [alias]),
        auth
      }
    })
  }

  withPresence(): this {
    return this.state(async (player) => {
      return {
        presence: await new PlayerPresenceFactory(player.game).construct(player).one()
      }
    })
  }
}
