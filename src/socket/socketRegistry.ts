import Socket from './index'

let socketInstance: Socket | null = null

export function setSocketInstance(socket: Socket) {
  socketInstance = socket
}

export function getSocketInstance(): Socket | null {
  return socketInstance
}
