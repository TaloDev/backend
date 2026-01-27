export async function truncateTables() {
  await global.em.execute('SET FOREIGN_KEY_CHECKS = 0;')

  const tables = await global.em.execute(`
    SELECT table_name as tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
  `)

  for (const { tableName } of tables) {
    await global.em.execute(`TRUNCATE TABLE \`${tableName}\`;`)
  }

  await global.em.execute('SET FOREIGN_KEY_CHECKS = 1;')
}
