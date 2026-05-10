import { EntityManager } from '@mikro-orm/mysql'
import APIKey, { APIKeyScope } from '../../entities/api-key.js'
import Game from '../../entities/game.js'
import PlayerAlias from '../../entities/player-alias.js'
import Player from '../../entities/player.js'
import checkScope from '../../policies/checkScope.js'
import checkPricingPlanPlayerLimit from '../billing/checkPricingPlanPlayerLimit.js'
import { hardSanitiseProps } from '../props/sanitiseProps.js'

export type CreatePlayerInput = {
  aliases?: { service: string; identifier: string }[]
  props?: { key: string; value: string }[]
  devBuild?: boolean
}

type PlayerCreationErrorParams = {
  statusCode: number
  message: string
  errorCode?: string
  field?: string
}

export class PlayerCreationError extends Error {
  statusCode: number
  errorCode?: string
  field?: string

  constructor({ statusCode, message, errorCode, field }: PlayerCreationErrorParams) {
    super(message)
    this.name = 'PlayerCreationError'
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.field = field
  }
}

export async function createPlayer(em: EntityManager, game: Game, input: CreatePlayerInput) {
  const { aliases, props, devBuild } = input

  await em.populate(game, ['organisation.pricingPlan.pricingPlan'])
  await checkPricingPlanPlayerLimit(em, game.organisation)

  const player = new Player(game)

  if (aliases) {
    for (const { service, identifier } of aliases) {
      const trimmedService = service.trim()
      const trimmedIdentifier = identifier.trim()

      const count = await em.repo(PlayerAlias).count({
        service: trimmedService,
        identifier: trimmedIdentifier,
        player: { game },
      })

      if (count > 0) {
        throw new PlayerCreationError({
          statusCode: 400,
          message: `Player with identifier '${trimmedIdentifier}' already exists`,
          errorCode: 'IDENTIFIER_TAKEN',
          field: 'aliases',
        })
      }

      const alias = new PlayerAlias()
      alias.service = trimmedService
      alias.identifier = trimmedIdentifier
      player.aliases.add(alias)
    }
  }

  if (props) {
    try {
      player.setProps(hardSanitiseProps({ props }))
    } catch (err) {
      throw new PlayerCreationError({
        statusCode: 400,
        message: (err as Error).message,
        field: 'props',
      })
    }
  }

  if (devBuild) {
    player.markAsDevBuild()
  }

  await em.persist(player).flush()
  await player.checkGroupMemberships(em)

  return player
}

export async function createPlayerFromIdentifyRequest({
  em,
  key,
  service,
  identifier,
  initialProps,
  devBuild,
}: {
  em: EntityManager
  key: APIKey
  service: string
  identifier: string
  initialProps?: { key: string; value: string }[]
  devBuild?: boolean
}) {
  if (checkScope(key, APIKeyScope.WRITE_PLAYERS)) {
    return createPlayer(em, key.game, {
      aliases: [{ service, identifier }],
      props: initialProps,
      devBuild,
    })
  } else {
    throw new PlayerCreationError({
      statusCode: 404,
      message:
        'Player not found. Use an access key with the write:players scope to automatically create players',
    })
  }
}
