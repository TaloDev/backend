import { Request } from 'koa-clay'
import { UserType } from '../entities/user.js'
import Policy from './policy.js'

const UserTypeGate = (types: UserType[], action: string) => (tar: Policy, _: string, descriptor: PropertyDescriptor) => {
  const base = descriptor.value

  descriptor.value = async function (...args) {
    const req: Request = args[0]

    if (!req.ctx.state.user.api) {
      const user = await tar.getUser(req)
      if (![UserType.OWNER, ...types].includes(user.type)) req.ctx.throw(403, `You do not have permissions to ${action}`)
    }

    const result = await base.apply(this, args)
    return result
  }

  return descriptor
}

export default UserTypeGate
