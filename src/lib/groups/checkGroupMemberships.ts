import { EntityManager } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'
import { getResultCacheOptions } from '../perf/getResultCacheOptions'

const enableLogging = process.env.NODE_ENV !== 'test'

class PlayerGroupMember {
  player: Player
  group: PlayerGroup

  constructor(player: Player, group: PlayerGroup) {
    this.player = player
    this.group = group
  }

  toJSON() {
    return {
      player_id: this.player.id,
      player_group_id: this.group.id
    }
  }
}

export default async function checkGroupMemberships(em: EntityManager, player: Player): Promise<boolean> {
  const groups = await em.repo(PlayerGroup).find({
    game: player.game
  }, getResultCacheOptions(`groups-for-memberships-${player.game.id}`, 1000))

  if (groups.length === 0) {
    return false
  }

  const label = `Checking group memberships for ${player.id}`

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.time(label)
  }

  let shouldRefresh = false

  for (const group of groups) {
    await group.members.init({ ref: true })
    const playerIsEligible = await group.isPlayerEligible(em, player)
    const playerCurrentlyInGroup = group.members.getItems().some((member) => member.id === player.id)

    const eligibleButNotInGroup = playerIsEligible && !playerCurrentlyInGroup
    const notEligibleButInGroup = !playerIsEligible && playerCurrentlyInGroup

    if (eligibleButNotInGroup || notEligibleButInGroup) {
      shouldRefresh = true
    }

    const groupMember = new PlayerGroupMember(player, group)

    if (eligibleButNotInGroup) {
      /* v8 ignore next 3 */
      if (enableLogging) {
        console.info(`${player.id} is eligible for ${group.id}`)
      }
      await em.insert('player_group_members', groupMember.toJSON())
    } else if (notEligibleButInGroup) {
      /* v8 ignore next 3 */
      if (enableLogging) {
        console.info(`${player.id} is no longer eligible for ${group.id}`)
      }
      await em.nativeDelete('player_group_members', groupMember.toJSON())
    }
  }

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.timeEnd(label)
  }

  return shouldRefresh
}
