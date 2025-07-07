import { Cursor, Loaded } from '@mikro-orm/core'

export async function* streamCursor<T extends object>(
  fetchPage: (batchSize: number, after?: string) => Promise<Cursor<T>>,
  batchSize = 100
): AsyncGenerator<Loaded<T>> {
  let cursor: string | undefined

  while (true) {
    const page = await fetchPage(batchSize, cursor)

    if (!page?.items?.length) break

    for (const item of page.items) {
      yield item
    }

    /* v8 ignore next 3 */
    if (!page.endCursor || page.items.length < batchSize) break
    cursor = page.endCursor
  }
}
