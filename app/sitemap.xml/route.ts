import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SITE_ORIGIN = "https://telehub.to"
const FRAMER_ORIGIN = "https://blessed-estimate-419559.framer.app"
const SUPABASE_BATCH_SIZE = 1000

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
}

if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
})

type SitemapEntry = {
    url: string
    lastModified?: string | null
}

type ListingRow = {
    id: string
    short_invite?: string | null
    slug?: string | null
    updated_at?: string | null
    last_synced_at?: string | null
    created_at?: string | null
    listing_type?: string | null
    language_code?: string | null
}

// These Framer routes are utility, auth, redirect, or non-canonical shell routes.
// They should not be advertised as indexable pages in TeleHub's sitemap.
const EXCLUDED_FRAMER_PATHS = new Set([
    "/admin",
    "/dashboard",
    "/login",
    "/welcome",
    "/go",
    "/embed",
    "/channel",
    "/report",
    "/upgrade",
])

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function normalizePathname(pathname: string) {
    if (!pathname || pathname === "/") return "/"
    return `/${pathname.replace(/^\/+|\/+$/g, "")}`
}

function shouldIncludeFramerPath(pathname: string) {
    const normalized = normalizePathname(pathname)

    if (EXCLUDED_FRAMER_PATHS.has(normalized)) return false
    if (normalized.startsWith("/admin/")) return false
    if (normalized.startsWith("/dashboard/")) return false
    if (normalized.startsWith("/login/")) return false
    if (normalized.startsWith("/go/")) return false
    if (normalized.startsWith("/channel/")) return false

    return true
}

async function getCanonicalFramerEntries(): Promise<SitemapEntry[]> {
    try {
        const response = await fetch(`${FRAMER_ORIGIN}/sitemap.xml`, {
            headers: {
                Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
                "User-Agent": "TeleHubSitemap/1.0 (+https://telehub.to)",
            },
            next: { revalidate: 3600 },
        })

        if (!response.ok) {
            console.error(
                "Framer sitemap fetch failed:",
                response.status,
                response.statusText
            )
            return []
        }

        const xml = await response.text()
        const entries: SitemapEntry[] = []
        const locPattern = /<loc>([\s\S]*?)<\/loc>/gi
        let match: RegExpExecArray | null

        while ((match = locPattern.exec(xml))) {
            const rawLocation = String(match[1] || "")
                .replace(/&amp;/g, "&")
                .trim()

            if (!rawLocation) continue

            try {
                const sourceUrl = new URL(rawLocation, FRAMER_ORIGIN)
                const pathname = normalizePathname(sourceUrl.pathname)

                if (!shouldIncludeFramerPath(pathname)) continue

                entries.push({
                    url:
                        pathname === "/"
                            ? `${SITE_ORIGIN}/`
                            : `${SITE_ORIGIN}${pathname}`,
                })
            } catch (error) {
                console.error("Could not parse Framer sitemap URL:", {
                    rawLocation,
                    error,
                })
            }
        }

        return entries
    } catch (error) {
        console.error("Framer sitemap fetch threw:", error)
        return []
    }
}

async function getApprovedListingEntries(): Promise<{
    listings: SitemapEntry[]
    languageLandings: SitemapEntry[]
}> {
    const entries: SitemapEntry[] = []
    const languageTypes = new Map<string, Set<string>>()

    for (let from = 0; ; from += SUPABASE_BATCH_SIZE) {
        const to = from + SUPABASE_BATCH_SIZE - 1

        const { data, error } = await supabase
            .from("channel_listings")
            .select(
                "id, short_invite, slug, updated_at, last_synced_at, created_at, listing_type, language_code"
            )
            .eq("status", "approved")
            .or("is_banned.is.null,is_banned.eq.false")
            .not("short_invite", "is", null)
            .order("id", { ascending: true })
            .range(from, to)

        if (error) {
            throw new Error(`Supabase sitemap query failed: ${error.message}`)
        }

        const rows = (data || []) as ListingRow[]

        for (const listing of rows) {
            const shortInvite = String(listing.short_invite || "")
                .trim()
                .toLowerCase()

            if (!shortInvite) continue

            entries.push({
                url: `${SITE_ORIGIN}/channel/${encodeURIComponent(shortInvite)}`,
                lastModified:
                    listing.updated_at ||
                    listing.last_synced_at ||
                    listing.created_at ||
                    null,
            })

            const languageCode = String(
                listing.language_code || ""
            ).trim().toLowerCase()
            const listingType = String(
                listing.listing_type || "channel"
            ).toLowerCase()

            if (/^[a-z]{2,3}$/.test(languageCode)) {
                const types =
                    languageTypes.get(languageCode) || new Set<string>()
                types.add(
                    listingType === "group" ? "groups" : "channels"
                )
                languageTypes.set(languageCode, types)
            }
        }

        if (rows.length < SUPABASE_BATCH_SIZE) break
    }

    const languageLandings: SitemapEntry[] = []

    for (const [languageCode, types] of languageTypes.entries()) {
        for (const type of types) {
            languageLandings.push({
                url: `${SITE_ORIGIN}/${type}/${encodeURIComponent(languageCode)}`,
            })
        }
    }

    return {
        listings: entries,
        languageLandings,
    }
}

function dedupeEntries(entries: SitemapEntry[]) {
    const byUrl = new Map<string, SitemapEntry>()

    for (const entry of entries) {
        const existing = byUrl.get(entry.url)

        if (!existing) {
            byUrl.set(entry.url, entry)
            continue
        }

        if (!existing.lastModified && entry.lastModified) {
            byUrl.set(entry.url, entry)
        }
    }

    return Array.from(byUrl.values()).sort((a, b) =>
        a.url.localeCompare(b.url)
    )
}

function renderSitemap(entries: SitemapEntry[]) {
    const body = entries
        .map((entry) => {
            const lastModified = entry.lastModified
                ? `\n    <lastmod>${escapeXml(new Date(entry.lastModified).toISOString())}</lastmod>`
                : ""

            return `  <url>\n    <loc>${escapeXml(entry.url)}</loc>${lastModified}\n  </url>`
        })
        .join("\n")

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export async function GET() {
    try {
        const [framerEntries, listingResult] = await Promise.all([
            getCanonicalFramerEntries(),
            getApprovedListingEntries(),
        ])

        const listingEntries = listingResult.listings
        const languageLandingEntries = listingResult.languageLandings
        const entries = dedupeEntries([
            ...framerEntries,
            ...languageLandingEntries,
            ...listingEntries,
        ])
        const xml = renderSitemap(entries)

        return new Response(xml, {
            status: 200,
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control":
                    "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
                "X-TeleHub-Sitemap-Urls": String(entries.length),
                "X-TeleHub-Listing-Urls": String(listingEntries.length),
                "X-TeleHub-Language-Landings": String(
                    languageLandingEntries.length
                ),
            },
        })
    } catch (error) {
        console.error("TeleHub sitemap generation failed:", error)

        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`,
            {
                status: 500,
                headers: {
                    "Content-Type": "application/xml; charset=utf-8",
                    "Cache-Control": "no-store",
                },
            }
        )
    }
}
