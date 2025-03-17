import jwt from 'jsonwebtoken'

export function sign<T extends object>(payload: T, secret: string, options: jwt.SignOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(payload, secret, options, (err, token) => {
      if (err) reject(err)
      resolve(token as string)
    })
  })
}

export function verify<T extends object>(token: string, secret: string): Promise<T> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) reject(err)
      resolve(decoded as T)
    })
  })
}
