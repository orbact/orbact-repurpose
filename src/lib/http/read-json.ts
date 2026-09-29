export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function readJsonBody(request: Request, maxBytes = 64_000): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError('Request body is too large', 413)
  }
  if (!request.body) throw new RequestBodyError('Missing request body', 400)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > maxBytes) {
      await reader.cancel()
      throw new RequestBodyError('Request body is too large', 413)
    }
    chunks.push(value)
  }

  const combined = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combined))
  } catch {
    throw new RequestBodyError('Invalid JSON body', 400)
  }
}
