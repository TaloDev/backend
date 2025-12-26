import type { ZodSchema, z as zodType } from 'zod'
import type Koa from 'koa'
import type { AppParameterizedContext } from '../lib/context'

export type ValidationSchema = {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
  headers?: ZodSchema
}

export type InferValidation<V extends ValidationSchema> = {
  body: V['body'] extends ZodSchema ? zodType.infer<V['body']> : unknown
  query: V['query'] extends ZodSchema ? zodType.infer<V['query']> : unknown
  params: V['params'] extends ZodSchema ? zodType.infer<V['params']> : unknown
  headers: V['headers'] extends ZodSchema ? zodType.infer<V['headers']> : unknown
}

export type ValidatedContext<V extends ValidationSchema, S = Record<string, never>> =
  AppParameterizedContext<S> & {
    request: Omit<Koa.Request, 'body' | 'query' | 'headers'> & {
      body: InferValidation<V>['body']
      query: InferValidation<V>['query']
      headers: InferValidation<V>['headers']
    }
    params: InferValidation<V>['params']
  }

export function validate<V extends ValidationSchema, S = Record<string, never>>(
  schemaObject: V
): (ctx: AppParameterizedContext<S>, next: Koa.Next) => Promise<void> {
  return async (ctx, next) => {
    const targets = ['body', 'query', 'params', 'headers'] as const

    for (const target of targets) {
      const schema = schemaObject[target]
      if (!schema) continue

      let data: unknown
      if (target === 'body') {
        data = ctx.request.body
      } else if (target === 'query') {
        data = ctx.query
      } else if (target === 'params') {
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

      // attach validated data to context
      if (target === 'body') {
        ctx.request.body = result.data
      } else if (target === 'query') {
        ctx.query = result.data
      } else if (target === 'params') {
        ctx.params = result.data
      } else {
        ctx.headers = result.data
      }
    }

    await next()
  }
}
