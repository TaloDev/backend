import { ServiceRequest } from 'koa-rest-services'

const HasPermission = (Permission: any, method: string) => (tar: Object, _: string, descriptor: PropertyDescriptor) => {
  const base = descriptor.value

  descriptor.value = async function (...args) {
    const permission = new Permission()
    const hookResult = await permission[method](...args)
    if (!hookResult) {
      (<ServiceRequest>args[0]).ctx.throw(403, hookResult)
      return
    }

    const result = await base.apply(this, args)
    return result
  }

  return descriptor
}

export default HasPermission
