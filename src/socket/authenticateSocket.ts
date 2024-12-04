import { WebSocket } from 'ws'
import getAPIKeyFromToken from '../lib/auth/getAPIKeyFromToken'
import { promisify } from 'util'
import jwt from 'jsonwebtoken'
import { RequestContext } from '@mikro-orm/core'
import APIKey from '../entities/api-key'

export default async function authenticateSocket(authHeader: string, ws: WebSocket): Promise<APIKey> {
  const apiKey = await getAPIKeyFromToken(authHeader)
  if (!apiKey || apiKey.revokedAt) {
    ws.close(3000)
    return
  }

  apiKey.lastUsedAt = new Date()
  await RequestContext.getEntityManager().flush()

  try {
    const token = authHeader.split('Bearer ')[1]
    const secret = apiKey.game.apiSecret.getPlainSecret()
    await promisify(jwt.verify)(token, secret)
  } catch (err) {
    ws.close(3000)
    return
  }

  return apiKey
}
