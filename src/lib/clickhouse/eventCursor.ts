// Compare created_at and id separately so ClickHouse can use the
// (game_id, created_at, id) primary key
export function eventCursorClause(createdAtSql: string, idSql: string): string {
  return `(created_at > ${createdAtSql} OR (created_at = ${createdAtSql} AND id > ${idSql}))`
}
