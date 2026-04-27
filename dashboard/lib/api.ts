export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export const getHeaders = () => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY
    return {
        'Content-Type': 'application/json',
        ...(apiKey && { 'x-api-key': apiKey, Authorization: `Bearer ${apiKey}` }),
    }
}

export const buildApiError = async (response: Response, action: string) => {
    let detail = ''
    try {
        const raw = await response.text()
        if (raw) {
            try {
                const body = JSON.parse(raw)
                detail = body?.message || body?.error || JSON.stringify(body)
            } catch {
                detail = raw
            }
        }
    } catch {
        detail = ''
    }

    const authHint = response.status === 401 || response.status === 403
        ? ' Check NEXT_PUBLIC_API_KEY matches OPENMEMORY_API_KEY/OM_API_KEY.'
        : ''
    const suffix = detail ? `: ${detail}` : ''
    return new Error(`${action} failed (${response.status} ${response.statusText})${suffix}.${authHint}`)
}

export const ensureOk = async (response: Response, action: string) => {
    if (!response.ok) throw await buildApiError(response, action)
}
