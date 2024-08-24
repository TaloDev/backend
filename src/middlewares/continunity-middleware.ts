import { isValid } from 'date-fns'
import { Context, Next } from 'koa'

export default async (ctx: Context, next: Next): Promise<void> => {
  const header = ctx.headers['x-talo-continuity-timestamp']

  if (header) {
    const date = new Date(Number(header))
    if (isValid(date)) {
      ctx.state.continuityDate = date
    }
  }

  await next()
}
