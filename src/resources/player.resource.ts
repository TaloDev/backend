import { EntityResource } from 'koa-rest-services'
import Player, { PlayerAliases } from '../entities/player'

export default class PlayerResource extends EntityResource<Player> {
  id: string
  props: { [key: string]: any }
  aliases: PlayerAliases
  createdAt: Date
  lastSeenAt: Date

  constructor(entity: Player) {
    super(entity)
    this.id = entity.id
    this.props = entity.props
    this.aliases = entity.aliases
    this.createdAt = entity.createdAt
    this.lastSeenAt = entity.lastSeenAt
  }
}
