import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import casual from 'casual'
import Player from '../../src/entities/player'
import PlayerAliasFactory from './PlayerAliasFactory'
import { Collection } from '@mikro-orm/mysql'
import PlayerAlias from '../../src/entities/player-alias'
import { sub } from 'date-fns'
import PlayerProp from '../../src/entities/player-prop'
import PlayerAuthFactory from './PlayerAuthFactory'

export default class PlayerFactory extends Factory<Player> {
  private availableGames: Game[]

  constructor(availableGames: Game[]) {
    super(Player)

    this.availableGames = availableGames
  }

  protected definition(): void {
    const availableProps = ['zonesExplored', 'currentArea', 'position.x', 'position.y', 'deaths', 'position.z', 'currentLevel', 'inventorySpace', 'currentHealth', 'currentMana', 'currentEnergy', 'npcKills', 'playerKills']

    this.state(async (player) => {
      const propsCount = casual.integer(0, 5)
      const props: PlayerProp[] = Array.from({ length: propsCount }, () => {
        return new PlayerProp(player, casual.random_element(availableProps), String(casual.integer(0, 99)))
      })

      const aliases = await new PlayerAliasFactory(player).many(casual.integer(1, 2))

      return {
        aliases: new Collection<PlayerAlias>(player, aliases),
        game: casual.random_element(this.availableGames),
        props: new Collection<PlayerProp>(player, props),
        lastSeenAt: sub(new Date(), { days: casual.integer(0, 10) })
      }
    })
  }

  notSeenToday(): this {
    return this.state(() => ({
      lastSeenAt: sub(new Date(), { days: casual.integer(1, 99) })
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
      lastSeenAt: sub(new Date(), { days: casual.integer(0, 6) })
    }))
  }

  createdThisWeek(): this {
    return this.state(() => ({
      lastSeenAt: sub(new Date(), { days: casual.integer(0, 6) }),
      createdAt: sub(new Date(), { days: casual.integer(0, 6) })
    }))
  }

  devBuild(): this {
    return this.state((player: Player) => {
      player.addProp('META_DEV_BUILD', '1')
      return player
    })
  }

  withSteamAlias(): this {
    return this.state(async (player: Player) => {
      const alias = await new PlayerAliasFactory(player).steam().one()

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
}
