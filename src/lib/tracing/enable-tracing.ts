import { init as initHyperDX } from '@hyperdx/node-opentelemetry'
import { Connection, MySqlConnection } from '@mikro-orm/mysql'
import { metrics, SpanStatusCode, trace, ValueType } from '@opentelemetry/api'

// mysql otel tracing doesn't work for esm, configure a custom hook
export function instrumentStatements() {
  const executeQueryDescriptor = Object.getOwnPropertyDescriptor(
    Connection.prototype,
    'executeQuery',
  )

  if (!executeQueryDescriptor) {
    return
  }

  Object.defineProperty(Connection.prototype, 'executeQuery', {
    value: async function <T>(
      query: string,
      cb: () => Promise<T>,
      context?: Record<string, unknown>,
    ) {
      const span = trace.getTracer('mysql').startSpan('mysql.query', {
        attributes: {
          'db.system': 'mysql',
          'db.statement': query,
          'db.operation': query.trim().split(/\s+/)[0].toUpperCase(),
        },
      })

      try {
        return await executeQueryDescriptor.value.call(this, query, cb, context)
      } catch (error) {
        span.recordException(error as Error)
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        })
        throw error
      } finally {
        span.end()
      }
    },
    writable: true,
    configurable: true,
  })
}

// nested transactions run savepoint statements instead of BEGIN/COMMIT
const TRANSACTION_STATEMENTS = {
  begin: { plain: 'BEGIN', savepoint: 'SAVEPOINT' },
  commit: { plain: 'COMMIT', savepoint: 'RELEASE SAVEPOINT' },
  rollback: { plain: 'ROLLBACK', savepoint: 'ROLLBACK TO SAVEPOINT' },
} as const

type TransactionMethod = keyof typeof TRANSACTION_STATEMENTS

// begin() receives the parent context in its options
// commit()/rollback() receive the transaction itself
function isSavepoint(method: TransactionMethod, arg: unknown) {
  if (typeof arg !== 'object' || arg === null) {
    return false
  }

  return method === 'begin' ? Boolean((arg as { ctx?: unknown }).ctx) : 'savepointName' in arg
}

function findMethod(proto: object | null, method: string) {
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, method)

    if (descriptor) {
      return { proto, descriptor }
    }

    proto = Object.getPrototypeOf(proto)
  }

  return null
}

export function instrumentTransactions() {
  for (const method of Object.keys(TRANSACTION_STATEMENTS) as TransactionMethod[]) {
    // begin/rollback live on the sql connection, commit is overridden by the mysql connection
    const found = findMethod(MySqlConnection.prototype, method)

    if (!found) {
      continue
    }

    Object.defineProperty(found.proto, method, {
      ...found.descriptor,
      value: async function (...args: unknown[]) {
        const operation =
          TRANSACTION_STATEMENTS[method][isSavepoint(method, args[0]) ? 'savepoint' : 'plain']
        const span = trace.getTracer('mysql').startSpan('mysql.transaction', {
          attributes: {
            'db.system': 'mysql',
            'db.statement': operation,
            'db.operation': operation,
          },
        })

        try {
          return await found.descriptor.value.apply(this, args)
        } catch (error) {
          span.recordException(error as Error)
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          })
          throw error
        } finally {
          span.end()
        }
      },
    })
  }
}

if (process.env.NODE_ENV !== 'test' && typeof process.env.HYPERDX_API_KEY === 'string') {
  initHyperDX({
    service: 'talo',
    instrumentations: {
      '@opentelemetry/instrumentation-http': {
        ignoreOutgoingRequestHook: (req) => req.hostname === process.env.CLICKHOUSE_HOST,
      },
    },
  })

  // monitor memory usage
  const nodeMonitorMeter = metrics.getMeter('node-monitor-meter')
  const gauge = nodeMonitorMeter.createObservableGauge('process.runtime.nodejs.memory.heap.total', {
    unit: 'bytes',
    valueType: ValueType.INT,
  })
  gauge.addCallback((result) => {
    result.observe(process.memoryUsage().heapTotal)
  })

  instrumentStatements()
  instrumentTransactions()
}
