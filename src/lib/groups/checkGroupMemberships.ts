import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/mysql'
import Player from '../../entities/player'
import PlayerGroup from '../../entities/player-group'

const enableLogging = process.env.NODE_ENV !== 'test'

export default async function checkGroupMemberships(em: EntityManager, player: Player) {
  const groups = await em.getRepository(PlayerGroup).find({ game: player.game })
  if (groups.length === 0) {
    return
  }

  const startTime = Date.now()
  const globalLabel = `Checking group memberships for ${player.id} (${startTime})`
  const flushLabel = `Memberships flush ${player.id} (${startTime})`

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.time(globalLabel)
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

  try {
    if (shouldFlush) {
      /* v8 ignore next 3 */
      if (enableLogging) {
        console.time(flushLabel)
      }

      await em.flush()
    }
  /* v8 ignore next 5 */
  } catch (err) {
    if (err instanceof UniqueConstraintViolationException) {
      console.warn('This player is already in the group')
    }
  } finally {
    if (shouldFlush) {
      /* v8 ignore next 3 */
      if (enableLogging) {
        console.timeEnd(flushLabel)
      }
    }
  }

  /* v8 ignore next 3 */
  if (enableLogging) {
    console.timeEnd(globalLabel)
  }
}
