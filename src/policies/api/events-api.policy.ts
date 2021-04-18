import Policy from '../policy'

export default class EventsAPIPolicy extends Policy {
  async get(): Promise<boolean> {
    return await this.hasScope('read:events')
  }

  async post(): Promise<boolean> {
    return await this.hasScope('write:events')
  }
}
