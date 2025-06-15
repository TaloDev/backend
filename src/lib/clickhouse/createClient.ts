import { ClickHouseClient, createClient, QueryParams, ExecParams, InsertParams } from '@clickhouse/client'
import { Attributes, Span, SpanStatusCode, trace } from '@opentelemetry/api'

function extractTableNameFromQuery(query: string): string | undefined {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim()

  // Regex for "SELECT ... FROM table_name" or "DELETE FROM table_name"
  // It looks for 'FROM' followed by one or more spaces, then captures the table name.
  // It handles optional database.table or schema.table names, and quoted names (`table`, "table", 'table').
  // The (?:...) creates a non-capturing group for the "SELECT .* " part.
  const regex = /(?:^SELECT\s+.*?\s+FROM|^DELETE\s+FROM)\s+(`?["']?[\w.-]+["']?`?)/i
  const match = normalizedQuery.match(regex)

  if (match && match[1]) {
    // The captured table name might include quotes or backticks. Remove them.
    const tableName = match[1].replace(/[`"']/g, '')
    return tableName
  }

  return undefined
}

function cleanStatement(query: string) {
  const parts = query.split('\n')
  const cleanedParts = parts.map((part) => part.trim())
  return cleanedParts.join('\n')
}

function buildOtelAttributes(methodName: string, params: unknown): Attributes {
  const attributes: Attributes = {
    'db.system': 'clickhouse',
    'db.operation': methodName
  }

  switch (methodName) {
    case 'query':
    case 'exec':
      attributes['db.statement'] = cleanStatement((params as QueryParams | ExecParams).query)
      if ((params as QueryParams).format) {
        attributes['db.clickhouse.table'] = extractTableNameFromQuery(attributes['db.statement'])
        attributes['db.clickhouse.format'] = (params as QueryParams).format
      }
      break
    case 'insert':
      attributes['db.clickhouse.table'] = (params as InsertParams<unknown>).table
      attributes['db.statement'] = `INSERT INTO ${(params as InsertParams<unknown>).table}`
      if (Array.isArray((params as InsertParams<unknown>).values)) {
        attributes['db.clickhouse.rows'] = ((params as InsertParams<unknown>).values as Array<unknown>).length
      }
      break
  }
  return attributes
}

async function withTracing<T>(
  name: string,
  attributes: Attributes,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = trace.getTracer('talo.clickhouse')
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await operation(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    } finally {
      span.end()
    }
  })
}

function createClickHouseTracingProxyHandler(): ProxyHandler<ClickHouseClient> {
  const tracedClickHouseMethods = ['query', 'exec', 'insert']
  return {
    get: (target, prop, receiver) => {
      if (typeof prop === 'string' && tracedClickHouseMethods.includes(prop)) {
        const originalMethod = Reflect.get(target, prop, receiver) as (...args: unknown[]) => Promise<unknown>
        return (...args: unknown[]) => {
          const attributes = buildOtelAttributes(prop, args[0])
          const operation = `clickhouse.${prop}.${attributes['db.clickhouse.table']}`
          return withTracing(operation, attributes, () => originalMethod.apply(target, args))
        }
      }

      return Reflect.get(target, prop, receiver)
    }
  }
}

export default function createTracedClickHouseClient(): ClickHouseClient {
  const client = createClient({
    url: `http://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}/${process.env.CLICKHOUSE_DB}`
  })

  return new Proxy(client, createClickHouseTracingProxyHandler())
}
