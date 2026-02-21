export default function updateAllowedKeys<T>(
  entity: T,
  body: Record<string, unknown>,
  allowedKeys: (keyof T)[],
): [T, string[]] {
  const changedProperties: string[] = []

  for (const key in body) {
    const typedKey = key as keyof T

    if (allowedKeys.includes(typedKey)) {
      const original = entity[typedKey]
      entity[typedKey] = body[key] as T[keyof T]

      if (original !== entity[typedKey]) {
        changedProperties.push(key)
      }
    }
  }

  return [entity, changedProperties]
}
