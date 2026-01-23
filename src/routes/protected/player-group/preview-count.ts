import { createHash } from 'crypto'
import { z } from 'zod'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import PlayerGroup from '../../../entities/player-group'
import { withResponseCache } from '../../../lib/perf/responseCache'
import { buildRulesFromData, rulesAndModeSchema } from './common'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'

export const previewCountRoute = protectedRoute({
  method: 'get',
  path: '/preview-count',
  schema: (z) => ({
    query: z.object({
      rules: z.string(),
      ruleMode: z.string()
    })
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { rules: rulesStr, ruleMode } = ctx.state.validated.query
    const em = ctx.em

    let parsedData: unknown
    try {
      parsedData = {
        rules: JSON.parse(decodeURI(rulesStr)),
        ruleMode
      }
    } catch {
      return buildErrorResponse({ rules: ['Rules must be valid JSON'] })
    }

    const result = rulesAndModeSchema(z).safeParse(parsedData)
    if (!result.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        errors[key] = errors[key] ?? []
        errors[key].push(issue.message)
      }
      return buildErrorResponse(errors)
    }

    const { rules, ruleMode: validatedRuleMode } = result.data

    const devDataComponent = ctx.state.includeDevData ? 'dev' : 'no-dev'
    const hash = createHash('sha256')
      .update(JSON.stringify({
        rules: rulesStr,
        ruleMode,
        gameId: ctx.state.game.id,
        includeDevData: devDataComponent
      }))
      .digest('hex')

    return withResponseCache({ key: hash }, async () => {
      const group = new PlayerGroup(ctx.state.game)
      group.rules = buildRulesFromData(rules)
      group.ruleMode = validatedRuleMode

      const query = group.getQuery(em)
      if (!ctx.state.includeDevData) {
        query.andWhere({ devBuild: false })
      }
      const count = await query.getCount()

      return {
        status: 200,
        body: {
          count
        }
      }
    })
  }
})
