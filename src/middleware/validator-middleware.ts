import { ZodSchema } from 'zod'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'

export function validator<T extends ZodSchema>(
  target: 'json' | 'query' | 'param' | 'header',
  buildSchema: (zod: typeof z) => T
) {
  const schema = buildSchema(z)
  return createMiddleware(async (c, next) => {
    let data: unknown

    switch (target) {
      case 'json':
        data = await c.req.json()
        break
      case 'query':
        data = c.req.query()
        break
      case 'param':
        data = c.req.param()
        break
      case 'header':
        data = c.req.header()
        break
    }

    const result = schema.safeParse(data)
    if (!result.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || target
        if (!errors[path]) {
          errors[path] = []
        }
        errors[path].push(issue.message)
      }

      return c.json({ errors }, 400)
    }

    await next()
  })
}
