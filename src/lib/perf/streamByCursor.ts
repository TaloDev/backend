import type { Cursor } from '@mikro-orm/mysql'

const DEFAULT_BATCH_SIZE = 1000

export async function* streamByCursorPages<
  T extends object,
  Hint extends string = never,
  Fields extends string = never,
  Excludes extends string = never,
  IncludeCount extends boolean = true,
>(
  fetchPage: (
    batchSize: number,
    after?: string,
  ) => Promise<Cursor<T, Hint, Fields, Excludes, IncludeCount>>,
  batchSize = DEFAULT_BATCH_SIZE,
) {
  let cursor: string | undefined

  while (true) {
    const page = await fetchPage(batchSize, cursor)

    if (!page?.items?.length) break

    yield page.items

    /* v8 ignore next 3 -- @preserve */
    if (!page.endCursor || page.items.length < batchSize) {
      break
    }

    cursor = page.endCursor
  }
}

export async function* streamByCursor<
  T extends object,
  Hint extends string = never,
  Fields extends string = never,
  Excludes extends string = never,
  IncludeCount extends boolean = true,
>(
  fetchPage: (
    batchSize: number,
    after?: string,
  ) => Promise<Cursor<T, Hint, Fields, Excludes, IncludeCount>>,
  batchSize = DEFAULT_BATCH_SIZE,
) {
  for await (const items of streamByCursorPages(fetchPage, batchSize)) {
    yield* items
  }
}
