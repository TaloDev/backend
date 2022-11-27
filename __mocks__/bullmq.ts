import { EventEmitter } from 'events'

const bullEmitter = new EventEmitter()

type Processor<T> = (job: Job<T>) => void|Promise<void>

export class Job<T> {
  queueName: string
  name: string
  data: T

  constructor(queueName: string, name: string, data: T) {
    this.queueName = queueName
    this.name = name
    this.data = data
  }
}

export class Worker<T> extends EventEmitter {
  queueName: string
  processor: Processor<T>

  constructor(queueName: string, processor: Processor<T>) {
    super()

    this.queueName = queueName
    this.processor = processor
    bullEmitter.emit('worker-registered', this)
  }

  async process(job: Job<T>): Promise<void> {
    try {
      await this.processor(job)

      await Promise.all(this.listeners('completed').map(async (handler) => {
        await handler(job)
      }))
    } catch (err) {
      await Promise.all(this.listeners('failed').map(async (handler) => {
        await handler(job, err)
      }))
    }
  }
}

export class Queue<T> {
  name: string
  workers: Worker<T>[] = []

  constructor(name: string) {
    this.name = name
    bullEmitter.on('worker-registered', (worker: Worker<T>) => {
      if (worker.queueName === this.name) {
        this.workers.push(worker)
        bullEmitter.removeAllListeners('worker-registered')
      }
    })
  }

  async add(jobName: string, data: T) {
    const job = new Job<T>(this.name, jobName, data)
    await Promise.all(this.workers.map(async (worker) => await worker.process(job)))
  }
}
