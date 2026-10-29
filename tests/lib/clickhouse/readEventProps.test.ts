import { ClickHouseClient } from '@clickhouse/client'
import { readEventProps } from '../../../src/lib/clickhouse/readEventProps.js'

describe('readEventProps', () => {
  it('should return an empty map without querying when there are no events', async () => {
    const query = vi.fn()
    const clickhouse = { query } as unknown as ClickHouseClient

    await expect(readEventProps({ clickhouse, events: [] })).resolves.toStrictEqual(new Map())
    expect(query).not.toHaveBeenCalled()
  })
})
