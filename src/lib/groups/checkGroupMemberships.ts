import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'

export default async function checkGroupMemberships(em: EntityManager, player: Player) {
  const groups = await em.getRepository(PlayerGroup).find({ game: player.game })

  for (const group of groups) {
    const eligiblePlayers = await group.getQuery(em).getResultList()
    const playerIsEligible = eligiblePlayers.some((eligiblePlayer) => eligiblePlayer.id === player.id)
    const playerCurrentlyInGroup = player.groups.getItems().some((playerGroup) => playerGroup.id === group.id)

    const eligibleButNotInGroup = playerIsEligible && !playerCurrentlyInGroup
    const notEligibleButInGroup = !playerIsEligible && playerCurrentlyInGroup

    if (eligibleButNotInGroup || notEligibleButInGroup) {
      await em.clearCache(group.getQueryCacheKey())
      await group.members.init({ ref: true })
    }

    if (eligibleButNotInGroup) {
      try {
        group.members.add(player)
      /* v8 ignore next 5 */
      } catch (err) {
        if (err instanceof UniqueConstraintViolationException) {
          console.warn('This player is already in the group')
        }
      }
    } else if (notEligibleButInGroup) {
      const member = group.members.getItems().find((member) => member.id === player.id)
      if (member) {
        group.members.remove(member)
      }
    }
  }

  await em.flush()
}
