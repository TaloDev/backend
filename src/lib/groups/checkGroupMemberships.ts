import { EntityManager } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'

export default async function checkGroupMemberships(em: EntityManager, player: Player) {
  const groups = await em.getRepository(PlayerGroup).find({ game: player.game })

  for (const group of groups) {
    await group.members.loadItems()

    const eligiblePlayers = await group.getQuery(em).getResultList()
    const playerIsEligible = eligiblePlayers.some((eligiblePlayer) => eligiblePlayer.id === player.id)
    const playerCurrentlyInGroup = group.members.getItems().some((p) => p.id === player.id)

    if (playerIsEligible && !playerCurrentlyInGroup) {
      group.members.add(player)
    } else if (!playerIsEligible && playerCurrentlyInGroup) {
      const member = group.members.getItems().find((member) => member.id === player.id)
      if (member) {
        group.members.remove(member)
      }
    }
  }

  await em.flush()
}
