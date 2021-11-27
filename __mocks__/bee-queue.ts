import { EventEmitter } from 'events'

class Job<T> extends EventEmitter {
  data: T
  queue: Queue<T>
  date: Date

  constructor(data: T, queue: Queue<T>)  {
    super()
    this.data = data
    this.queue = queue
    this.date = new Date()
  }

  delayUntil(date: Date): Job<T> {
    this.date = date
    return this
  }

  async save(): Promise<Job<T>> {
    try {
      await this.queue.handler(this)
    } catch (err) {
      this.emit('failed', err)
    }

    return this
  }
}

export default class Queue<T = unknown> extends EventEmitter {
  handler: (job: Job<T>) => Promise<T>
  name: string

  constructor(name: string) {
    super()
    this.name = name
  }

  async process(handler: (job: Job<T>) => Promise<T>): Promise<void> {
    this.handler = handler
  }

  createJob(data: T): Job<T> {
    const job = new Job<T>(data, this)
    job.on('failed', (err: Error) => {
      this.emit('failed', job, err)
    })

    return job
  }
}
