import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SITE_ORIGIN = "https://telehub.to"
const FRAMER_ORIGIN = "https://blessed-estimate-419559.framer.app"

function upstreamPathFor(pathname: string) {
    const match = pathname.match(/^\/(channels|groups|all)\/([a-z]{2,3}|mixed)\/?$/i)

    if (match) {
        return `/${match[1].toLowerCase()}`
    }

    return pathname || "/"
}

function canonicalUrlFor(request: NextRequest) {
    const pathname = request.nextUrl.pathname || "/"
    return pathname === "/"
        ? `${SITE_ORIGIN}/`
        : `${SITE_ORIGIN}${pathname}`
}

function replaceOrInsertCanonical(html: string, canonical: string) {
    const canonicalTag = `<link rel="canonical" href="${canonical}">`
    const canonicalPattern = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i

    if (canonicalPattern.test(html)) {
        return html.replace(canonicalPattern, canonicalTag)
    }

    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${canonicalTag}`)
}

function replaceOrInsertMeta(
    html: string,
    attribute: "property" | "name",
    key: string,
    value: string
) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(
        `<meta\\b[^>]*\\b${attribute}=["']${escapedKey}["'][^>]*>`,
        "i"
    )
    const tag = `<meta ${attribute}="${key}" content="${value}">`

    if (pattern.test(html)) {
        return html.replace(pattern, tag)
    }

    return html.replace(/<head(\s[^>]*)?>/i, (match) => `${match}\n${tag}`)
}

function rewriteFramerHtml(html: string, canonical: string) {
    let output = html

    output = replaceOrInsertCanonical(output, canonical)
    output = replaceOrInsertMeta(output, "property", "og:url", canonical)
    output = replaceOrInsertMeta(output, "property", "og:site_name", "TeleHub")

    // Framer can emit absolute references to its preview hostname in JSON-LD or
    // other SEO metadata. Rewrite only occurrences inside structured-data scripts
    // so the public custom domain stays canonical without touching Framer assets.
    output = output.replace(
        /(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
        (_match, open, json, close) => {
            const rewritten = String(json).replaceAll(FRAMER_ORIGIN, SITE_ORIGIN)
            return `${open}${rewritten}${close}`
        }
    )

    return output
}

function copyResponseHeaders(source: Headers) {
    const headers = new Headers()

    source.forEach((value, key) => {
        const lower = key.toLowerCase()

        if (
            lower === "content-length" ||
            lower === "content-encoding" ||
            lower === "transfer-encoding" ||
            lower === "connection"
        ) {
            return
        }

        if (lower === "location") {
            headers.set(key, value.replace(FRAMER_ORIGIN, SITE_ORIGIN))
            return
        }

        headers.set(key, value)
    })

    headers.set("x-telehub-framer-proxy", "canonical-rewrite-v1")
    return headers
}

async function proxy(request: NextRequest) {
    const incomingPath = request.nextUrl.pathname || "/"
    const upstreamPath = upstreamPathFor(incomingPath)
    const upstreamUrl = new URL(upstreamPath, FRAMER_ORIGIN)
    upstreamUrl.search = request.nextUrl.search

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-forwarded-host", "telehub.to")
    requestHeaders.set("x-forwarded-proto", "https")
    requestHeaders.delete("content-length")

    const hasBody = !["GET", "HEAD"].includes(request.method)
    const requestBody = hasBody ? await request.arrayBuffer() : undefined

    const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: requestHeaders,
        body: requestBody,
        redirect: "manual",
        cache: "no-store",
    })

    const headers = copyResponseHeaders(upstream.headers)

    if (request.method === "HEAD") {
        return new Response(null, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers,
        })
    }

    const contentType = upstream.headers.get("content-type") || ""

    if (contentType.toLowerCase().includes("text/html")) {
        const html = await upstream.text()
        const rewritten = rewriteFramerHtml(html, canonicalUrlFor(request))

        headers.set("content-type", "text/html; charset=utf-8")

        return new Response(rewritten, {
            status: upstream.status,
            statusText: upstream.statusText,
            headers,
        })
    }

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
    })
}

export async function GET(request: NextRequest) {
    return proxy(request)
}

export async function HEAD(request: NextRequest) {
    return proxy(request)
}

export async function POST(request: NextRequest) {
    return proxy(request)
}

export async function PUT(request: NextRequest) {
    return proxy(request)
}

export async function PATCH(request: NextRequest) {
    return proxy(request)
}

export async function DELETE(request: NextRequest) {
    return proxy(request)
}

export async function OPTIONS(request: NextRequest) {
    return proxy(request)
}
