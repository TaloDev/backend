import { Server } from 'http'
import { WebSocketServer } from 'ws'

export default function configureSocketRoutes(server: Server) {
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws, req) => {
    ws.on('error', console.error)

    console.log(req.headers)

    ws.on('message', function message(data) {
      console.log('Received:', data)
      ws.send('Thanks')
    })

    ws.send('Hello')
  })
}
