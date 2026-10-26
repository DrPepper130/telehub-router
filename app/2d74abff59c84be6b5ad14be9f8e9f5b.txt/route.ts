export const dynamic = "force-static"

const INDEXNOW_KEY = "2d74abff59c84be6b5ad14be9f8e9f5b"

export function GET() {
    return new Response(INDEXNOW_KEY, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
    })
}

export function HEAD() {
    return new Response(null, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
    })
}
