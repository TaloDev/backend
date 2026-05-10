import { EntityManager } from '@mikro-orm/mysql'
import APIKey from '../../entities/api-key.js'
import PlayerAlias from '../../entities/player-alias.js'

export async function findAliasFromIdentifyRequest({
  em,
  key,
  service,
  identifier,
}: {
  em: EntityManager
  key: APIKey
  service: string
  identifier: string
}) {
  return em.repo(PlayerAlias).findOne({
    service: service.trim(),
    identifier: identifier.trim(),
    player: {
      game: key.game,
    },
  })
}
