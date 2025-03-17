import { Request } from 'koa-clay'
import { UserType } from '../entities/user'
import Policy from './policy'

const UserTypeGate = (types: UserType[], action: string) => (tar: Policy, _: string, descriptor: PropertyDescriptor) => {
  const base = descriptor.value

  descriptor.value = async function (req: Request) {
    if (!req.ctx.state.user.api) {
      const user = await tar.getUser(req)
      if (![UserType.OWNER, ...types].includes(user.type)) req.ctx.throw(403, `You do not have permissions to ${action}`)
    }

    return base.apply(this, [req])
  }

  return descriptor
}

export default UserTypeGate
