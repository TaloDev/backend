import { Context, Next } from 'koa'

export default async function loggerMiddleware(ctx: Context, next: Next) {
  if (ctx.path === '/public/health') {
    return await next()
  }

  console.info(`--> ${ctx.method} ${ctx.path}`)

  ctx.res.on('finish', () => {
    console.info(`<-- ${ctx.method} ${ctx.path} ${ctx.status}`)
  })

  await next()
}
