import type { ZodType, z } from 'zod'
import type Koa from 'koa'
import type { AppParameterizedContext } from '../lib/routing/context'
import { RouteState } from '../lib/routing/state'

export type ValidationSchema = {
  body?: ZodType
  query?: ZodType
  route?: ZodType
  headers?: ZodType
}

export type InferValidation<V extends ValidationSchema> = {
  body: V['body'] extends ZodType ? z.infer<V['body']> : unknown
  query: V['query'] extends ZodType ? z.infer<V['query']> : unknown
  route: V['route'] extends ZodType ? z.infer<V['route']> : unknown
  headers: V['headers'] extends ZodType ? z.infer<V['headers']> : unknown
}

export type ValidatedContext<V extends ValidationSchema, S extends RouteState> =
  AppParameterizedContext<S> & {
    state: S & {
      validated: InferValidation<V>
    }
  }

export function validate<V extends ValidationSchema, S extends RouteState>(
  schemaObject: V
): (ctx: AppParameterizedContext<S>, next: Koa.Next) => Promise<void> {
  return async (ctx, next) => {
    const targets = ['body', 'query', 'route', 'headers'] as const
    const validated: Record<typeof targets[number], unknown> = {
      body: {},
      query: {},
      route: {},
      headers: {}
    }

    for (const target of targets) {
      const schema = schemaObject[target]
      if (!schema) continue

      let data: unknown
      if (target === 'body') {
        data = ctx.request.body
      } else if (target === 'query') {
        data = ctx.query
      } else if (target === 'route') {
        data = ctx.params
      } else {
        data = ctx.headers
      }

      const result = schema.safeParse(data)
      if (!result.success) {
        const errors: Record<string, string[]> = {}
        for (const issue of result.error.issues) {
          const path = issue.path.join('.')
          if (!errors[path]) {
            errors[path] = []
          }
          errors[path].push(issue.message)
        }

        ctx.status = 400
        ctx.body = { errors }
        return
      }

      validated[target] = result.data
    }

    (ctx.state as ValidatedContext<V, S>['state']).validated = validated as InferValidation<V>

    await next()
  }
}
