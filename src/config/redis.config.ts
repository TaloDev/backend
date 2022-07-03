export default {
  host: process.env.REDIS_HOST ?? 'redis',
  password: process.env.REDIS_PASSWORD
}
