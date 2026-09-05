import { EntityManager } from '@mikro-orm/mysql'
import { PlayerToDelete } from '../../entities/player-to-delete.js'
import Player from '../../entities/player.js'

export async function queuePlayersForDeletion(em: EntityManager, players: Player[]) {
  await em.repo(PlayerToDelete).upsertMany(
    players.map((player) => new PlayerToDelete(player)),
    { onConflictFields: ['player'], onConflictAction: 'ignore' },
  )

  return players.length
}
