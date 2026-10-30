import type { NextRequest } from "next/server"
import { unstable_cache } from "next/cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SITE_ORIGIN = "https://telehub.to"
const FRAMER_ORIGIN = "https://telehubadvertising.framer.website"
const BACKEND_ORIGIN = "https://telegramboard.onrender.com"

// /welcome and /upgrade are public landing pages and may be indexed.
const NOINDEX_PATHS = new Set([
    "/admin", "/dashboard", "/login", "/go", "/embed", "/report",
])

type HomepageListing = {
    short_invite?: string
    channel_name?: string
    telegram_title?: string
    telegram_username?: string
    description?: string
    telegram_description?: string
    icon_url?: string
    image_url?: string
    member_count?: number
    votes_count?: number
    ranking_score?: number
    paid_rank?: string
    paid_rank_status?: string
    categories?: string[]
    listing_type?: string
    created_at?: string
    is_nsfw?: boolean
    is_banned?: boolean
    status?: string
}

const escapeHtml = (value: unknown): string => String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

function safeImageUrl(value: unknown) {
    try {
        const url = new URL(String(value || ""))
        return url.protocol === "https:" ? url.toString() : ""
    } catch { return "" }
}

function cleanSlug(value: unknown) {
    return String(value || "").toLowerCase().trim()
        .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
}

// Reuse the existing cached backend endpoint. Next's data cache ensures that
// normal traffic doesn't add another backend call for every homepage request.
const getHomepageSnapshot = unstable_cache(async (): Promise<HomepageListing[]> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3500)
    try {
        const response = await fetch(`${BACKEND_ORIGIN}/api/listings/homepage-static`, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
            cache: "no-store",
        })
        if (!response.ok) throw new Error(`Homepage API ${response.status}`)
        const data = await response.json()
        if (!Array.isArray(data?.listings)) return []
        return data.listings as HomepageListing[]
    } finally { clearTimeout(timeout) }
}, ["telehub-homepage-ssr-v1"], { revalidate: 1800 })

function homepageRank(item: HomepageListing) {
    if (item.paid_rank_status !== "active") return 0
    return ({ sponsor: 3, gold: 2, silver: 1 } as Record<string, number>)[
        String(item.paid_rank || "").toLowerCase()
    ] || 0
}

function renderHomepageSnapshot(listings: HomepageListing[]): string {
    const now = Date.now()
    const threeDays = 3 * 86400000
    const allowed = listings.filter(item =>
        !!cleanSlug(item.short_invite) && !item.is_nsfw && !item.is_banned &&
        (!item.status || item.status === "approved")
    ).map(item => {
        const age = now - new Date(item.created_at || "").getTime()
        const newBoost = Number.isFinite(age) && age >= 0 && age < threeDays
            ? (threeDays - age) / threeDays * 1000 : 0
        return { ...item, _score: Number(item.ranking_score || 0) + newBoost }
    }).sort((a,b) => homepageRank(b) - homepageRank(a) || b._score - a._score)
      .slice(0, 15)

    if (!allowed.length) return ""

    const cards = allowed.map(item => {
        const slug = cleanSlug(item.short_invite)
        const url = `/channel/${encodeURIComponent(slug)}`
        const name = String(item.channel_name || item.telegram_title || "Telegram Community")
        const text = String(item.description || item.telegram_description || "")
            .replace(/\s+/g, " ").trim().slice(0, 160)
        const category = (item.categories || []).slice(0, 2).join(" · ")
        const members = Number(item.member_count || 0)
        const votes = Number(item.votes_count || 0)
        const image = safeImageUrl(item.icon_url)
        const icon = image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" width="44" height="44">` : `<span class="th-ssr-icon">✈</span>`
        return `<article class="th-ssr-card">
          <div class="th-ssr-title">${icon}<div><h3><a href="${url}">${escapeHtml(name)}</a></h3>
          <small>${escapeHtml(item.listing_type === "group" ? "Telegram group" : "Telegram channel")}${category ? ` · ${escapeHtml(category)}` : ""}</small></div></div>
          <p>${escapeHtml(text || `Explore ${name} on TeleHub.`)}</p>
          <div class="th-ssr-stats"><span>${members.toLocaleString("en-US")} members</span><span>${votes.toLocaleString("en-US")} votes</span></div>
          <a class="th-ssr-view" href="${url}">View community</a>
        </article>`
    }).join("")

    // This is ordinary human-visible fallback content, not crawler-only text.
    // It disappears once Framer's normal, styled React cards have loaded.
    return `<section id="telehub-ssr-listings" aria-label="Popular Telegram communities" class="th-ssr-section">
      <div class="th-ssr-inner"><h2>Popular Telegram Communities</h2>
      <p>Explore Telegram channels and groups ranked by TeleHub.</p>
      <div class="th-ssr-grid">${cards}</div></div></section>`
}

const SSR_STYLES = `<style id="telehub-ssr-styles">
#telehub-ssr-listings{padding:40px 24px;background:linear-gradient(180deg,#eef6fc,#e6f0f8);font-family:Inter,system-ui,sans-serif;color:#102a43}
#telehub-ssr-listings .th-ssr-inner{max-width:1180px;margin:auto}
#telehub-ssr-listings h2{font-size:clamp(28px,4vw,42px);letter-spacing:-.03em;margin:0 0 8px}
#telehub-ssr-listings .th-ssr-inner>p{color:#64748b;margin:0 0 24px}
#telehub-ssr-listings .th-ssr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
#telehub-ssr-listings .th-ssr-card{display:flex;flex-direction:column;min-width:0;border:2px solid #94a3b8;border-radius:22px;background:#101d32;color:#fff;padding:18px;box-shadow:0 14px 36px #0f172a24}
#telehub-ssr-listings .th-ssr-title{display:flex;gap:12px;align-items:center}
#telehub-ssr-listings .th-ssr-title img,#telehub-ssr-listings .th-ssr-icon{width:44px;height:44px;border-radius:50%;object-fit:cover;flex-shrink:0}
#telehub-ssr-listings .th-ssr-icon{display:grid;place-items:center;background:#006fff;color:#fff}
#telehub-ssr-listings h3{font-size:17px;margin:0 0 4px;overflow-wrap:anywhere}
#telehub-ssr-listings a{color:inherit;text-decoration:none}
#telehub-ssr-listings small{color:#cbd5e1}
#telehub-ssr-listings .th-ssr-card p{font-size:14px;line-height:1.55;flex:1}
#telehub-ssr-listings .th-ssr-stats{display:flex;gap:18px;border-top:1px solid #94a3b8;padding-top:12px;font-size:13px}
#telehub-ssr-listings .th-ssr-view{display:block;margin-top:18px;padding:12px;background:#006fff;border-radius:10px;text-align:center;font-weight:700}
@media(max-width:950px){#telehub-ssr-listings .th-ssr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){#telehub-ssr-listings .th-ssr-grid{grid-template-columns:1fr}}
/* The real Framer cards win as soon as client rendering finishes. */
body:has(.telegram-grid .telegram-listing-card) #telehub-ssr-listings{display:none!important}
</style>`


// Only stable, crawlable directory URLs receive server-rendered snapshots.
// Search, arbitrary filters and NSFW mode remain interactive only.
type DirectoryKind = "all" | "channel" | "group"
type DirectoryRoute = {
    kind: DirectoryKind
    page: number
    category: string
    language: string
    pathname: string
    categoryType: string
}
const SEO_CATEGORIES: Record<string, string> = {
    gaming: "Gaming", crypto: "Crypto", ai: "AI", anime: "Anime",
    music: "Music", news: "News", trading: "Trading", technology: "Technology",
}

function directoryRouteFor(request: NextRequest): DirectoryRoute | null {
    const pathname = normalizePathname(request.nextUrl.pathname).toLowerCase()
    const segments = pathname.split("/").filter(Boolean)
    const kind: DirectoryKind | null = segments[0] === "all" ? "all"
        : segments[0] === "channels" ? "channel"
        : segments[0] === "groups" ? "group" : null
    if (!kind || segments.length > 2) return null
    const params = request.nextUrl.searchParams
    const pageParam = params.get("page")
    const page = pageParam === null ? 1 : Number(pageParam)
    // Bound the cache-key space so arbitrary URLs cannot create unlimited queries.
    if (!Number.isSafeInteger(page) || page < 1 || page > 200) return null
    if (params.has("q") || params.has("sort") || params.has("nsfw") || params.has("category") || params.has("language")) return null

    let category = ""
    let language = ""
    if (segments.length === 2) {
        const slug = segments[1]
        if (kind === "all" && SEO_CATEGORIES[slug]) category = SEO_CATEGORIES[slug]
        else if (/^[a-z]{2,3}$/.test(slug) || slug === "mixed") language = slug
        else return null
    }
    const categoryType = String(params.get("type") || "").toLowerCase()
    if (params.has("type") && (!category || !["channel", "group"].includes(categoryType))) return null
    // Keep cache keys canonical: only an optional page and category-specific type.
    for (const key of params.keys()) {
        if (!["page", "type"].includes(key) && !key.startsWith("utm_") && key !== "gclid" && key !== "fbclid") return null
    }
    return { kind, page, category, language, pathname, categoryType }
}

type DirectorySnapshot = { listings: HomepageListing[], totalPages: number }
const getDirectorySnapshot = unstable_cache(
    async (kind: DirectoryKind, page: number, category: string, language: string, categoryType: string): Promise<DirectorySnapshot> => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3500)
        try {
            const query = new URLSearchParams({
                type: categoryType || kind, page: String(page), page_size: "18", sort: "Top", nsfw: "0",
            })
            if (category) query.set("category", category)
            if (language) query.set("language", language)
            const response = await fetch(`${BACKEND_ORIGIN}/api/directory?${query}`, {
                headers: { Accept: "application/json" },
                signal: controller.signal, cache: "no-store",
            })
            if (!response.ok) throw new Error(`Directory ${kind} API ${response.status}`)
            const data = await response.json()
            return {
                listings: Array.isArray(data?.listings) ? data.listings : [],
                totalPages: Math.max(1, Number(data?.total_pages || 1)),
            }
        } finally { clearTimeout(timeout) }
    },
    ["telehub-directory-ssr-v2"],
    { revalidate: 1800 }
)

function directoryPageLink(route: DirectoryRoute, page: number) {
    const params = new URLSearchParams()
    if (route.categoryType) params.set("type", route.categoryType)
    if (page > 1) params.set("page", String(page))
    return `${route.pathname}${params.size ? `?${params.toString()}` : ""}`
}

function renderDirectorySnapshot(route: DirectoryRoute, data: DirectorySnapshot) {
    const { kind, page, category, language, categoryType } = route
    const allowed = data.listings.filter(item => {
        if (!cleanSlug(item.short_invite) || item.is_nsfw || item.is_banned) return false
        if (item.status && item.status !== "approved") return false
        const type = String(item.listing_type || "").toLowerCase()
        const expectedType = categoryType || kind
        if (expectedType === "channel" && type && type !== "channel") return false
        if (expectedType === "group" && type && type !== "group") return false
        return true
    }).slice(0, 18)
    if (!allowed.length) return ""

    const noun = categoryType === "group" || (!categoryType && kind === "group") ? "Groups"
        : categoryType === "channel" || (!categoryType && kind === "channel") ? "Channels" : "Communities"
    const label = category || (language ? language.toUpperCase() : "Popular")
    const cards = allowed.map(item => {
        const url = `/channel/${encodeURIComponent(cleanSlug(item.short_invite))}`
        const name = String(item.channel_name || item.telegram_title || "Telegram Community")
        const description = String(item.description || item.telegram_description || "")
            .replace(/\s+/g, " ").trim().slice(0, 160)
        const categoryLabel = Array.isArray(item.categories) ? item.categories.slice(0, 2).join(" · ") : ""
        const members = Math.max(0, Number(item.member_count || 0))
        const votes = Math.max(0, Number(item.votes_count || 0))
        const iconUrl = safeImageUrl(item.icon_url)
        const icon = iconUrl
            ? `<img src="${escapeHtml(iconUrl)}" alt="" loading="lazy" width="44" height="44">`
            : `<span class="th-ssr-icon">✈</span>`
        return `<article class="th-ssr-card">
          <div class="th-ssr-title">${icon}<div><h3><a href="${url}">${escapeHtml(name)}</a></h3>
          <small>${item.listing_type === "group" ? "Telegram group" : "Telegram channel"}${categoryLabel ? ` · ${escapeHtml(categoryLabel)}` : ""}</small></div></div>
          <p>${escapeHtml(description || `Explore ${name} on TeleHub.`)}</p>
          <div class="th-ssr-stats"><span>${Number.isFinite(members) ? members.toLocaleString("en-US") : "0"} members</span><span>${Number.isFinite(votes) ? votes.toLocaleString("en-US") : "0"} votes</span></div>
          <a class="th-ssr-view" href="${url}">View community</a>
        </article>`
    }).join("")
    const prev = page > 1 ? `<a href="${escapeHtml(directoryPageLink(route, page - 1))}">Previous page</a>` : ""
    const next = page < data.totalPages ? `<a href="${escapeHtml(directoryPageLink(route, page + 1))}">Next page</a>` : ""
    const links = prev || next ? `<nav class="th-ssr-pages" aria-label="Directory pages">${prev}${next}</nav>` : ""
    return `<section id="telehub-directory-ssr" aria-label="${escapeHtml(label)} Telegram ${noun}" class="th-ssr-section">
      <div class="th-ssr-inner"><h2>${escapeHtml(label)} Telegram ${noun}</h2>
      <p>Explore Telegram ${noun.toLowerCase()} ranked by TeleHub${page > 1 ? ` · Page ${page}` : ""}.</p>
      <div class="th-ssr-grid">${cards}</div>${links}</div></section>`
}

// Shared appearance with the homepage fallback; Framer's interactive directory
// cards replace the snapshot as soon as the requested results finish loading.
const DIRECTORY_SSR_STYLES = SSR_STYLES.replaceAll(
    "#telehub-ssr-listings", "#telehub-directory-ssr"
).replace('id="telehub-ssr-styles"', 'id="telehub-directory-ssr-styles"')
 .replace('body:has(.telegram-grid .telegram-listing-card) #telehub-directory-ssr',
          'body:has(.telegram-listing-card[data-listing-id]) #telehub-directory-ssr')
 .replace('</style>', '#telehub-directory-ssr .th-ssr-pages{display:flex;gap:20px;justify-content:center;padding:28px 0 0}#telehub-directory-ssr .th-ssr-pages a{color:#006fff;font-weight:700}</style>')

function normalizePathname(pathname: string) {
    if (!pathname || pathname === "/") return "/"
    return `/${pathname.replace(/^\/+|\/+$/g, "")}`
}
function shouldNoindexPath(pathname: string) {
    const normalized = normalizePathname(pathname)
    if (NOINDEX_PATHS.has(normalized)) return true
    return ["/admin/", "/dashboard/", "/login/", "/go/"].some(p => normalized.startsWith(p))
}
function upstreamPathFor(pathname: string) {
    const match = pathname.match(/^\/(channels|groups|all)\/([a-z]{2,3}|mixed)\/?$/i)
    // Category routes need Framer's own category-specific landing page HTML.
    if (match && match[1].toLowerCase() === "all" && SEO_CATEGORIES[match[2].toLowerCase()]) return pathname
    return match ? `/${match[1].toLowerCase()}` : pathname || "/"
}
function canonicalUrlFor(request: NextRequest) {
    const pathname = request.nextUrl.pathname || "/"
    const route = directoryRouteFor(request)
    if (route) return `${SITE_ORIGIN}${directoryPageLink(route, route.page)}`
    return pathname === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${pathname}`
}
function replaceOrInsertCanonical(html: string, canonical: string) {
    const tag = `<link rel="canonical" href="${canonical}">`
    const pattern = /<link\b[^>]*\brel=["']canonical["'][^>]*>/i
    return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<head(\s[^>]*)?>/i, match => `${match}\n${tag}`)
}
function replaceOrInsertMeta(html: string, attribute: "property" | "name", key: string, value: string) {
    const tag = `<meta ${attribute}="${key}" content="${value}">`
    const pattern = new RegExp(`<meta\\b[^>]*\\b${attribute}=["']${key}["'][^>]*>`, "i")
    return pattern.test(html) ? html.replace(pattern, tag) : html.replace(/<head(\s[^>]*)?>/i, match => `${match}\n${tag}`)
}
function removeRobotsNoindexMeta(html: string) {
    return html.replace(/<meta\b[^>]*\bname=["'](?:robots|googlebot)["'][^>]*\bcontent=["'][^"']*\bnoindex\b[^"']*["'][^>]*>\s*/gi, "")
}
function rewriteFramerHtml(html: string, canonical: string, shouldNoindex: boolean) {
    let output = replaceOrInsertCanonical(html, canonical)
    output = replaceOrInsertMeta(output, "property", "og:url", canonical)
    output = replaceOrInsertMeta(output, "property", "og:site_name", "TeleHub")
    if (shouldNoindex) output = replaceOrInsertMeta(output, "name", "robots", "noindex, nofollow")
    else {
        output = removeRobotsNoindexMeta(output)
        output = replaceOrInsertMeta(output, "name", "robots", "index, follow")
    }
    return output.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi,
        (_match, open, json, close) => `${open}${String(json).replaceAll(FRAMER_ORIGIN, SITE_ORIGIN)}${close}`)
}
function copyResponseHeaders(source: Headers, shouldNoindex: boolean) {
    const headers = new Headers()
    source.forEach((value, key) => {
        const lower = key.toLowerCase()
        if ([
            "content-length",
            "content-encoding",
            "transfer-encoding",
            "connection",
            "x-robots-tag",
            "etag",
            "last-modified",
        ].includes(lower)) return
        headers.set(key, lower === "location" ? value.replace(FRAMER_ORIGIN, SITE_ORIGIN) : value)
    })
    if (shouldNoindex) headers.set("X-Robots-Tag", "noindex, nofollow")
    else headers.delete("X-Robots-Tag")
    headers.set("x-telehub-framer-proxy", "homepage-ssr-fallback-v1")
    headers.set("Cache-Control", "public, max-age=0, must-revalidate")
    return headers
}

async function proxy(request: NextRequest) {
    const incomingPath = request.nextUrl.pathname || "/"
    const isDirectoryUrl = /^\/(all|channels|groups)(?:\/|$)/i.test(incomingPath)
    const shouldNoindex = shouldNoindexPath(normalizePathname(incomingPath)) ||
        (isDirectoryUrl && !directoryRouteFor(request))
    const upstreamUrl = new URL(upstreamPathFor(incomingPath), FRAMER_ORIGIN)
    upstreamUrl.search = request.nextUrl.search
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-forwarded-host", "telehub.to")
    requestHeaders.set("x-forwarded-proto", "https")
    requestHeaders.delete("content-length")
    requestHeaders.delete("if-none-match")
    requestHeaders.delete("if-modified-since")
    requestHeaders.delete("if-match")
    requestHeaders.delete("if-unmodified-since")
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer()
    const upstream = await fetch(upstreamUrl, { method: request.method, headers: requestHeaders,
        body, redirect: "manual", cache: "no-store" })
    const headers = copyResponseHeaders(upstream.headers, shouldNoindex)
    if (request.method === "HEAD") return new Response(null, { status: upstream.status, statusText: upstream.statusText, headers })
    const contentType = upstream.headers.get("content-type") || ""
    if (contentType.toLowerCase().includes("text/html")) {
        let html = rewriteFramerHtml(await upstream.text(), canonicalUrlFor(request), shouldNoindex)
        if (incomingPath === "/" && upstream.ok) {
            try {
                const snapshot = renderHomepageSnapshot(await getHomepageSnapshot())
                if (snapshot && /<\/body>/i.test(html)) {
                    html = html.replace(/<\/head>/i, `${SSR_STYLES}</head>`)
                    html = html.replace(/<\/body>/i, `${snapshot}</body>`)
                }
            } catch (error) {
                // Homepage stays available even when the cache/backend is down.
                console.warn("TeleHub homepage SSR fallback unavailable:", error)
            }
        }
        if (request.method === "GET" && upstream.ok) {
            const directoryRoute = directoryRouteFor(request)
            if (directoryRoute) {
                try {
                    const data = await getDirectorySnapshot(
                        directoryRoute.kind, directoryRoute.page, directoryRoute.category,
                        directoryRoute.language, directoryRoute.categoryType
                    )
                    const snapshot = renderDirectorySnapshot(directoryRoute, data)
                    if (snapshot && /<\/body>/i.test(html)) {
                        html = html.replace(/<\/head>/i, `${DIRECTORY_SSR_STYLES}</head>`)
                        html = html.replace(/<\/body>/i, `${snapshot}</body>`)
                    }
                } catch (error) {
                    console.warn(`TeleHub ${directoryRoute.kind} directory SSR unavailable:`, error)
                }
            }
        }
        headers.set("content-type", "text/html; charset=utf-8")
        return new Response(html, { status: upstream.status, statusText: upstream.statusText, headers })
    }
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers })
}
export async function GET(request: NextRequest) { return proxy(request) }
export async function HEAD(request: NextRequest) { return proxy(request) }
export async function POST(request: NextRequest) { return proxy(request) }
export async function PUT(request: NextRequest) { return proxy(request) }
export async function PATCH(request: NextRequest) { return proxy(request) }
export async function DELETE(request: NextRequest) { return proxy(request) }
export async function OPTIONS(request: NextRequest) { return proxy(request) }
