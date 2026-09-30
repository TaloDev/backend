import { ClickHouseClient } from '@clickhouse/client'
import { EntityManager } from '@mikro-orm/mysql'
import { v4 } from 'uuid'
import { getGlobalRedis } from '../config/redis.config.js'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity.js'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime.js'
import { PropRejectionError } from '../lib/errors/propRejectionError.js'
import { clearCachePattern } from '../lib/perf/clearCachePattern.js'
import { hardSanitiseProps } from '../lib/props/sanitiseProps.js'
import Game from './game.js'
import PlayerAlias from './player-alias.js'
import Prop from './prop.js'

const eventMetaProps = [
  'META_OS',
  'META_GAME_VERSION',
  'META_WINDOW_MODE',
  'META_SCREEN_WIDTH',
  'META_SCREEN_HEIGHT',
]

export type ClickHouseEvent = {
  id: string
  name: string
  game_id: number
  player_alias_id: number
  dev_build: boolean
  created_at: string
  updated_at: string
}

export type ClickHouseEventProp = {
  event_id: string
  prop_key: string
  prop_value: string
  game_id: number
  dev_build: boolean
  created_at: string
}

export default class Event extends ClickHouseEntity<ClickHouseEvent, [string, Game]> {
  id: string = v4()
  name!: string
  props: Prop[] = []
  game!: Game
  playerAlias!: PlayerAlias
  createdAt!: Date
  updatedAt: Date = new Date()

  static getCatalogueCacheKey({
    game,
    includeDevData = false,
    wildcard = false,
  }: {
    game: Game
    includeDevData?: boolean
    wildcard?: boolean
  }) {
    return `event-catalogue-${game.id}-${wildcard ? '*' : includeDevData}`
  }

  static async clearCatalogueCache(game: Game) {
    await clearCachePattern(getGlobalRedis(), Event.getCatalogueCacheKey({ game, wildcard: true }))
  }

  static async massHydrate(
    em: EntityManager,
    data: ClickHouseEvent[],
    clickhouse: ClickHouseClient,
    loadProps: boolean = false,
  ): Promise<Event[]> {
    const playerAliasIds = Array.from(new Set(data.map((event) => event.player_alias_id)))

    const playerAliases = await em.repo(PlayerAlias).find({
      id: {
        $in: playerAliasIds,
      },
    })

    const playerAliasesMap = new Map<number, PlayerAlias>()
    playerAliases.forEach((alias) => playerAliasesMap.set(alias.id, alias))

    const propsMap = new Map<string, Prop[]>()
    if (loadProps && data.length > 0) {
      const eventIds = data.map((event) => event.id)
      const gameIds = Array.from(new Set(data.map((event) => event.game_id)))
      const times = data.map((event) => new Date(event.created_at).getTime())

      // props share the event's created_at, so we only read the ones inside this page's time range
      const props = await clickhouse
        .query({
          query: `
            SELECT *
            FROM event_props
            WHERE game_id IN ({gameIds:Array(UInt32)})
              AND created_at >= {start:DateTime64(3)}
              AND created_at <= {end:DateTime64(3)}
              AND event_id IN ({eventIds:Array(String)})
          `,
          query_params: {
            gameIds,
            start: formatDateForClickHouse(new Date(Math.min(...times))),
            end: formatDateForClickHouse(new Date(Math.max(...times))),
            eventIds,
          },
          format: 'JSONEachRow',
        })
        .then((res) => res.json<ClickHouseEventProp>())

      props.forEach((prop) => {
        if (!propsMap.has(prop.event_id)) {
          propsMap.set(prop.event_id, [])
        }
        propsMap.get(prop.event_id)!.push(new Prop(prop.prop_key, prop.prop_value))
      })
    }

    return data
      .map((eventData) => {
        const playerAlias = playerAliasesMap.get(eventData.player_alias_id)
        if (!playerAlias) {
          return null
        }

        const event = new Event()
        event.construct(eventData.name, playerAlias.player.game)
        event.id = eventData.id
        event.playerAlias = playerAlias
        event.createdAt = new Date(eventData.created_at)
        event.updatedAt = new Date(eventData.updated_at)

        if (loadProps) {
          event.props = propsMap.get(eventData.id) || []
        }

        return event
      })
      .filter((event) => !!event)
  }

  override construct(name: string, game: Game): this {
    this.name = name
    this.game = game

    return this
  }

  setProps(props: Prop[]) {
    const { accepted, rejected } = hardSanitiseProps({
      props,
      extraFilter: (prop) => {
        return !prop.key.startsWith('META_') || eventMetaProps.includes(prop.key)
      },
    })
    if (rejected.length > 0) {
      throw new PropRejectionError(rejected)
    }
    this.props = accepted

    this.props.forEach((prop) => {
      if (eventMetaProps.includes(prop.key)) {
        const existingProp = this.playerAlias.player.props
          .getItems()
          .find((playerProp) => playerProp.key === prop.key)
        if (existingProp) {
          existingProp.value = prop.value
        } else {
          this.playerAlias.player.addProp(prop.key, prop.value)
        }
      }
    })
  }

  override toInsertable(): ClickHouseEvent {
    return {
      id: this.id,
      name: this.name,
      game_id: this.game.id,
      player_alias_id: this.playerAlias.id,
      dev_build: this.playerAlias.player.devBuild,
      created_at: formatDateForClickHouse(this.createdAt),
      updated_at: formatDateForClickHouse(this.updatedAt),
    }
  }

  getInsertableProps(): ClickHouseEventProp[] {
    return this.props.map((prop) => ({
      event_id: this.id,
      prop_key: prop.key,
      prop_value: prop.value,
      game_id: this.game.id,
      dev_build: this.playerAlias.player.devBuild,
      created_at: formatDateForClickHouse(this.createdAt),
    }))
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      props: this.props,
      playerAlias: this.playerAlias,
      gameId: this.game.id,
      createdAt: this.createdAt,
    }
  }
}
