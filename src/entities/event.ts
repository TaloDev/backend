import { v4 } from 'uuid'
import { hardSanitiseProps } from '../lib/props/sanitiseProps'
import Game from './game'
import PlayerAlias from './player-alias'
import Prop from './prop'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { EntityManager } from '@mikro-orm/mysql'
import { ClickHouseClient } from '@clickhouse/client'
import ClickHouseEntity from '../lib/clickhouse/clickhouse-entity'

const eventMetaProps = ['META_OS', 'META_GAME_VERSION', 'META_WINDOW_MODE', 'META_SCREEN_WIDTH', 'META_SCREEN_HEIGHT']

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
}

export default class Event extends ClickHouseEntity<ClickHouseEvent, [string, Game], [ClickHouseClient, boolean]> {
  id: string = v4()
  name!: string
  props: Prop[] = []
  game!: Game
  playerAlias!: PlayerAlias
  createdAt!: Date
  updatedAt: Date = new Date()

  construct(name: string, game: Game): this {
    this.name = name
    this.game = game

    return this
  }

  setProps(props: Prop[]) {
    this.props = hardSanitiseProps(props, (prop) => {
      return !prop.key.startsWith('META_') || eventMetaProps.includes(prop.key)
    })

    this.props.forEach((prop) => {
      if (eventMetaProps.includes(prop.key)) {
        const existingProp = this.playerAlias.player.props.getItems().find((playerProp) => playerProp.key === prop.key)
        if (existingProp) {
          existingProp.value = prop.value
        } else {
          this.playerAlias.player.addProp(prop.key, prop.value)
        }
      }
    })
  }

  toInsertable(): ClickHouseEvent {
    return {
      id: this.id,
      name: this.name,
      game_id: this.game.id,
      player_alias_id: this.playerAlias.id,
      dev_build: this.playerAlias.player.devBuild,
      created_at: formatDateForClickHouse(this.createdAt),
      updated_at: formatDateForClickHouse(this.updatedAt)
    }
  }

  getInsertableProps(): ClickHouseEventProp[] {
    return this.props.map((prop) => ({
      event_id: this.id,
      prop_key: prop.key,
      prop_value: prop.value
    }))
  }

  async hydrate(em: EntityManager, data: ClickHouseEvent, clickhouse: ClickHouseClient, loadProps: boolean = false): Promise<this> {
    const game = await em.getRepository(Game).findOneOrFail(data.game_id)
    const playerAlias = await em.getRepository(PlayerAlias).findOneOrFail(data.player_alias_id, { populate: ['player'] })

    this.construct(data.name, game)
    this.id = data.id
    this.playerAlias = playerAlias
    this.createdAt = new Date(data.created_at)
    this.updatedAt = new Date(data.updated_at)

    if (loadProps) {
      const props = await clickhouse.query({
        query: `SELECT * FROM event_props WHERE event_id = '${data.id}'`,
        format: 'JSONEachRow'
      }).then((res) => res.json<ClickHouseEventProp>())

      this.props = props.map((prop) => new Prop(prop.prop_key, prop.prop_value))
    }

    return this
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      props: this.props,
      playerAlias: this.playerAlias,
      gameId: this.game.id,
      createdAt: this.createdAt
    }
  }
}
