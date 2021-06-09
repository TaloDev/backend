import { EventEmitter } from 'events'

class Job<T> extends EventEmitter {
  data: T
  queue: Queue<T>

  constructor(data: T, queue: Queue<T>)  {
    super()
    this.data = data
    this.queue = queue
  }

  async process(handler: (job: Job<T>) => Promise<T>): Promise<void> {
    await handler(this)
  }
}

export default class Queue<T = any> extends EventEmitter {
  job: Job<T>
  handler: (job: Job<T>) => Promise<T>
  name: string

  constructor(name: string) {
    super()
    this.name = name
  }

  async process(handler: (job: Job<T>) => Promise<T>): Promise<void> {
    this.handler = handler
  }

  createJob(data: T): Queue<T> {
    this.job = new Job(data, this)
    return this
  }

  delayUntil(date: Date): Queue<T> {
    return this
  }

  async save(): Promise<Queue<T>> {
    try {
      await this.job.process(this.handler)
    } catch (err) {
      this.emit('failed', this.job, err)
    }

    return this
  }
}
