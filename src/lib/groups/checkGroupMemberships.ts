import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'

const enableLogging = process.env.NODE_ENV !== 'test'

export default async function checkGroupMemberships(em: EntityManager, player: Player) {
  console.time('checkGroupMemberships')

  const groups = await em.getRepository(PlayerGroup).find({ game: player.game })
  if (groups.length === 0) {
    return
  }

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.info(`Checking group memberships for ${player.id}...`)
  }

  let shouldFlush = false

  for (const group of groups) {
    const playerIsEligible = await group.isPlayerEligible(em, player)
    const playerCurrentlyInGroup = player.groups.getItems().some((playerGroup) => playerGroup.id === group.id)

    const eligibleButNotInGroup = playerIsEligible && !playerCurrentlyInGroup
    const notEligibleButInGroup = !playerIsEligible && playerCurrentlyInGroup

    if (eligibleButNotInGroup || notEligibleButInGroup) {
      await group.members.init({ ref: true })
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

  try {
    if (shouldFlush) {
      console.time('checkGroupMemberships flush')
      await em.flush()
      console.timeEnd('checkGroupMemberships flush')
    }
  /* v8 ignore next 5 */
  } catch (err) {
    if (err instanceof UniqueConstraintViolationException) {
      console.warn('This player is already in the group')
    }
  }

  console.timeEnd('checkGroupMemberships')
}
