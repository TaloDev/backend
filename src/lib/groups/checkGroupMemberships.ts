import { EntityManager } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'

const enableLogging = process.env.NODE_ENV !== 'test'

export default async function checkGroupMemberships(em: EntityManager, player: Player): Promise<boolean> {
  const groups = await em.repo(PlayerGroup).find({ game: player.game })
  if (groups.length === 0) {
    return false
  }

  const label = `Checking group memberships for ${player.id}`

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.time(label)
  }

  let shouldFlush = false

  for (const group of groups) {
    await group.members.init({ ref: true })
    const playerIsEligible = await group.isPlayerEligible(em, player)
    const playerCurrentlyInGroup = group.members.getItems().some((member) => member.id === player.id)

    const eligibleButNotInGroup = playerIsEligible && !playerCurrentlyInGroup
    const notEligibleButInGroup = !playerIsEligible && playerCurrentlyInGroup

    if (eligibleButNotInGroup || notEligibleButInGroup) {
      shouldFlush = true
    }

    if (eligibleButNotInGroup) {
      /* v8 ignore next 3 */
      if (enableLogging) {
        console.info(`${player.id} is eligible for ${group.id}`)
      }
      group.members.add(player)
    } else if (notEligibleButInGroup) {
      const member = group.members.getItems().find((member) => member.id === player.id)
      if (member) {
        /* v8 ignore next 3 */
        if (enableLogging) {
          console.info(`${player.id} is no longer eligible for ${group.id}`)
        }

        group.members.remove(member)
      }
    }
  }

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.timeEnd(label)
  }

  return shouldFlush
}
