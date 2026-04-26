import type { Cursor } from '@mikro-orm/mysql'

export async function* streamByCursor<
  T extends object,
  Hint extends string = never,
  Fields extends string = never,
  Excludes extends string = never,
>(
  fetchPage: (batchSize: number, after?: string) => Promise<Cursor<T, Hint, Fields, Excludes>>,
  batchSize = 1000,
) {
  let cursor: string | undefined

  while (true) {
    const page = await fetchPage(batchSize, cursor)

    if (!page?.items?.length) break

    for (const item of page.items) {
      yield item
    }

    /* v8 ignore next 3 -- @preserve */
    if (!page.endCursor || page.items.length < batchSize) {
      break
    }

    cursor = page.endCursor
  }
}
