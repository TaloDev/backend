import { Request } from 'koa-clay'

export default function updateAllowedKeys<T>(entity: T, body: Request['body'], allowedKeys: (keyof T)[]): [T, string[]] {
  const changedProperties: string[] = []

  for (const key in body) {
    const typedKey = key as keyof T
    if (allowedKeys.includes(typedKey)) {
      const original = entity[typedKey]
      entity[typedKey] = body[key]
      if (original !== entity[typedKey]) changedProperties.push(key)
    }
  }

  return [entity, changedProperties]
}
