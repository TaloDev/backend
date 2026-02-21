import z from 'zod'

export const createPropsSchema = z.array(
  z.object({
    key: z.string(),
    value: z.string(),
  }),
  { error: 'Props must be an array' },
)

export const updatePropsSchema = z.array(
  z.object({
    key: z.string(),
    value: z.string().nullable(),
  }),
  { error: 'Props must be an array' },
)
