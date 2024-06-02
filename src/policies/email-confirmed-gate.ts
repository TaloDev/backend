import { Request } from 'koa-clay'
import Policy from './policy.js'

const EmailConfirmedGate = (action: string) => (tar: Policy, _: string, descriptor: PropertyDescriptor) => {
  const base = descriptor.value

  descriptor.value = async function (...args) {
    const req: Request = args[0]

    if (!req.ctx.state.user.api) {
      const user = await tar.getUser(req)
      if (!user.emailConfirmed) req.ctx.throw(403, `You need to confirm your email address to ${action}`)
    }

    const result = await base.apply(this, args)
    return result
  }

  return descriptor
}

export default EmailConfirmedGate
