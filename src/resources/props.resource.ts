import { EntityResource } from 'koa-rest-services'
import Props from '../lib/types/props'

export default class PropsResource extends EntityResource<Props> {
  async transform(): Promise<any> {
    return Object.keys(this.entity).map((key) => ({
      key,
      value: this.entity[key]
    }))
  }
}
