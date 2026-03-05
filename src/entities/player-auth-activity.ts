import { Entity, Enum, ManyToOne, PrimaryKey, Property } from '@mikro-orm/mysql'
import assert from 'node:assert'
import Player from './player'
import { PlayerAliasService } from './player-alias'

export enum PlayerAuthActivityType {
  REGISTERED,
  VERIFICATION_STARTED,
  VERIFICATION_FAILED,
  LOGGED_IN,
  LOGGED_OUT,
  CHANGED_PASSWORD,
  CHANGED_EMAIL,
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_COMPLETED,
  VERIFICATION_TOGGLED,
  CHANGE_PASSWORD_FAILED,
  CHANGE_EMAIL_FAILED,
  TOGGLE_VERIFICATION_FAILED,
  DELETED_AUTH,
  DELETE_AUTH_FAILED,
  PLAYER_MERGED,
  CHANGED_IDENTIFIER,
  CHANGE_IDENTIFIER_FAILED,
}

@Entity()
export default class PlayerAuthActivity {
  @PrimaryKey()
  id!: number

  @ManyToOne(() => Player, { eager: true, deleteRule: 'cascade' })
  player: Player

  @Enum(() => PlayerAuthActivityType)
  type!: PlayerAuthActivityType

  @Property({ type: 'json' })
  extra: {
    [key: string]: unknown
  } = {}

  @Property()
  createdAt: Date = new Date()

  constructor(player: Player) {
    this.player = player
  }

  private getAuthAlias() {
    const alias = this.player.aliases.find((alias) => alias.service === PlayerAliasService.TALO)
    // this should never happen:
    // if an alias is deleted, so are the auth activities
    assert(alias, 'No Talo alias found for player')
    return alias
  }

  /* v8 ignore start -- @preserve */
  private getActivity(): string {
    const authAlias = this.getAuthAlias()

    switch (this.type) {
      case PlayerAuthActivityType.REGISTERED:
        return `${authAlias.identifier} created their account`
      case PlayerAuthActivityType.VERIFICATION_STARTED:
        return `${authAlias.identifier} started verification`
      case PlayerAuthActivityType.VERIFICATION_FAILED:
        return `${authAlias.identifier} failed verification`
      case PlayerAuthActivityType.LOGGED_IN:
        return `${authAlias.identifier} logged in`
      case PlayerAuthActivityType.LOGGED_OUT:
        return `${authAlias.identifier} logged out`
      case PlayerAuthActivityType.CHANGED_PASSWORD:
        return `${authAlias.identifier} changed their password`
      case PlayerAuthActivityType.CHANGED_EMAIL:
        return `${authAlias.identifier} changed their email`
      case PlayerAuthActivityType.PASSWORD_RESET_REQUESTED:
        return `A password reset request was made for ${authAlias.identifier}'s account`
      case PlayerAuthActivityType.PASSWORD_RESET_COMPLETED:
        return `A password reset was completed for ${authAlias.identifier}'s account`
      case PlayerAuthActivityType.VERIFICATION_TOGGLED:
        return `${authAlias.identifier} toggled verification`
      case PlayerAuthActivityType.CHANGE_PASSWORD_FAILED:
        return `${authAlias.identifier} failed to change their password`
      case PlayerAuthActivityType.CHANGE_EMAIL_FAILED:
        return `${authAlias.identifier} failed to change their email`
      case PlayerAuthActivityType.TOGGLE_VERIFICATION_FAILED:
        return `${authAlias.identifier} failed to toggle verification`
      case PlayerAuthActivityType.DELETED_AUTH:
        return `${authAlias.identifier} deleted their account`
      case PlayerAuthActivityType.DELETE_AUTH_FAILED:
        return `${authAlias.identifier} failed to delete their account`
      case PlayerAuthActivityType.PLAYER_MERGED:
        return `A player was merged into ${authAlias.identifier}'s account`
      case PlayerAuthActivityType.CHANGED_IDENTIFIER:
        return `${authAlias.identifier} changed their identifier`
      case PlayerAuthActivityType.CHANGE_IDENTIFIER_FAILED:
        return `${authAlias.identifier} failed to change their identifier`
      default:
        return ''
    }
  }
  /* v8 ignore stop -- @preserve */

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      description: this.getActivity(),
      extra: this.extra,
      createdAt: this.createdAt,
    }
  }
}
