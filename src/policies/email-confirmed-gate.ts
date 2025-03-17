import { Request } from 'koa-clay'
import Policy from './policy'

const EmailConfirmedGate = (action: string) => (tar: Policy, _: string, descriptor: PropertyDescriptor) => {
  const base = descriptor.value

  descriptor.value = async function (req: Request) {
    if (!req.ctx.state.user.api) {
      const user = await tar.getUser(req)
      if (!user.emailConfirmed) req.ctx.throw(403, `You need to confirm your email address to ${action}`)
    }

    return base.apply(this, [req])
  }

  return descriptor
}

export default EmailConfirmedGate
