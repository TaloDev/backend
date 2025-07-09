import { EventEmitter } from 'events'

const bullEmitter = new EventEmitter()

type ProcessorFn<T> = (job: Job<T>) => void | Promise<void>
type Processor<T> = ProcessorFn<T> | string

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
      let processorFn: (job: Job<T>) => Promise<void> | void

      if (typeof this.processor === 'string') {
        const mod = await import(this.processor)
        processorFn = mod.default
      } else {
        processorFn = this.processor
      }

      await processorFn(job)
      await Promise.all(this.listeners('completed').map((handler) => handler(job)))
    } catch (err) {
      await Promise.all(this.listeners('failed').map((handler) => handler(job, err as Error)))
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
    await Promise.all(this.workers.map((worker) => worker.process(job)))
  }

  async upsertJobScheduler(jobName: string, options: { pattern: string, every: number }, jobOptions: { name: string }) {
    bullEmitter.emit('job-scheduler-upserted', jobName, options, jobOptions)
  }
}
