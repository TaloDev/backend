await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  sourcemap: 'external',
  minify: false,
  splitting: true,
  external: [
    'mock-aws-s3',
    'aws-sdk',
    'nock',
    'better-sqlite3',
    'sqlite3',
    'pg',
    'pg-query-stream',
    'tedious',
    'mysql',
    'mariadb',
    'libsql',
    'oracledb',
    'pg-native',
    'mysql2',
    '@mikro-orm/mongodb',
    '@mikro-orm/postgresql',
    '@mikro-orm/sqlite',
    '@mikro-orm/better-sqlite'
  ]
})
