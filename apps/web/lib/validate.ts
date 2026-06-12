import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

type ParseResult<T> =
  | { data: T; error: null }
  | { data: null; error: NextResponse }

export async function parseBody<T extends z.ZodTypeAny>(
  req: NextRequest,
  schema: T,
): Promise<ParseResult<z.infer<T>>> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return { data: null, error: NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 }) }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first.path.join('.')
    return {
      data: null,
      error: NextResponse.json(
        { error: field ? `${field}: ${first.message}` : first.message },
        { status: 400 },
      ),
    }
  }

  return { data: result.data, error: null }
}
