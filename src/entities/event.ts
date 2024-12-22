import { v4 } from 'uuid'
import sanitiseProps from '../lib/props/sanitiseProps'
import Game from './game'
import PlayerAlias from './player-alias'
import Prop from './prop'
import { formatDateForClickHouse } from '../lib/clickhouse/formatDateTime'
import { EntityManager } from '@mikro-orm/mysql'
import { NodeClickHouseClient } from '@clickhouse/client/dist/client'

const eventMetaProps = ['META_OS', 'META_GAME_VERSION', 'META_WINDOW_MODE', 'META_SCREEN_WIDTH', 'META_SCREEN_HEIGHT']

export type ClickhouseEvent = {
  id: string
  name: string
  game_id: number
  player_alias_id: number
  dev_build: boolean
  created_at: string
  updated_at: string
}

export type ClickhouseEventProp = {
  event_id: string
  prop_key: string
  prop_value: string
}

export default class Event {
  id: string
  name: string
  props: Prop[] = []
  game: Game
  playerAlias: PlayerAlias
  createdAt: Date
  updatedAt: Date = new Date()

  constructor(name: string, game: Game) {
    this.id = v4()
    this.name = name
    this.game = game
  }

  setProps(props: Prop[]) {
    this.props = sanitiseProps(props, true, (prop) => {
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

  getInsertableData(): ClickhouseEvent {
    return {
      id: this.id,
      name: this.name,
      game_id: this.game.id,
      player_alias_id: this.playerAlias.id,
      dev_build: this.playerAlias.player.isDevBuild(),
      created_at: formatDateForClickHouse(this.createdAt),
      updated_at: formatDateForClickHouse(this.updatedAt)
    }
  }

  getInsertableProps(): ClickhouseEventProp[] {
    return this.props.map((prop) => ({
      event_id: this.id,
      prop_key: prop.key,
      prop_value: prop.value
    }))
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

export async function createEventFromClickhouse(
  clickhouse: NodeClickHouseClient,
  em: EntityManager,
  data: ClickhouseEvent,
  loadProps = false
): Promise<Event> {
  const game = await em.getRepository(Game).findOne(data.game_id)
  const playerAlias = await em.getRepository(PlayerAlias).findOne(data.player_alias_id, { populate: ['player'] })

  const event = new Event(data.name, game)
  event.id = data.id
  event.playerAlias = playerAlias
  event.createdAt = new Date(data.created_at)
  event.updatedAt = new Date(data.updated_at)

  if (loadProps) {
    const props = await clickhouse.query({
      query: `SELECT * FROM event_props WHERE event_id = '${data.id}'`,
      format: 'JSONEachRow'
    }).then((res) => res.json<ClickhouseEventProp>())

    event.props = props.map((prop) => new Prop(prop.prop_key, prop.prop_value))
  }

  return event
}
