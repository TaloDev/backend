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
  }, getResultCacheOptions(PlayerGroup.getCacheKey(player.game), 10_000))

  if (groups.length === 0) {
    return false
  }

  const label = `Checking group memberships for ${player.id}`

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.time(label)
  }

  for (const group of groups) {
    const eligible = await group.isPlayerEligible(em, player)
    const groupMember = new PlayerGroupMember(player, group).toJSON()

    if (eligible) {
      await em.qb('player_group_members')
        .insert(groupMember)
        .onConflict()
        .ignore()
        .execute()
    } else {
      await em.nativeDelete('player_group_members', groupMember)
    }
  }

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.timeEnd(label)
  }

  return true
}
