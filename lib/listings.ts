import { createClient } from "@supabase/supabase-js"
import { cache } from "react"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY")

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
})

export type TeleHubListing = {
    id: string
    slug?: string | null
    short_invite?: string | null
    channel_name?: string | null
    telegram_title?: string | null
    telegram_username?: string | null
    telegram_link?: string | null
    description?: string | null
    long_description?: string | null
    telegram_description?: string | null
    categories?: string[] | string | null
    listing_type?: string | null
    member_count?: number | null
    votes_count?: number | null
    paid_rank?: string | null
    paid_rank_status?: string | null
    status?: string | null
    is_nsfw?: boolean | null
    is_banned?: boolean | null
    icon_url?: string | null
    image_url?: string | null
    created_at?: string | null
    last_synced_at?: string | null
}

function cleanSlug(value: string) {
    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
}

const MAX_ATTEMPTS = 3
const QUERY_TIMEOUT_MS = 4000

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// Only retry transport errors, rate limits and server-side failures.
// Configuration, permission and malformed-query errors should fail immediately.
function isRetryable(status: number, code?: string) {
    return status === 0 || status === 408 || status === 429 || status >= 500 ||
        code === "PGRST000" || code === "PGRST001" || code === "PGRST002" ||
        code === "PGRST003"
}

async function lookup(
    column: "short_invite" | "slug",
    value: string
): Promise<TeleHubListing | null> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)
        try {
            const result = await supabase
                .from("channel_listings")
                .select("*")
                .eq("status", "approved")
                .or("is_banned.is.null,is_banned.eq.false")
                .eq(column, value)
                .abortSignal(controller.signal)
                .maybeSingle()

            if (!result.error) return (result.data as TeleHubListing | null) ?? null

            const status = result.status || 0
            const retryable = isRetryable(status, result.error.code)
            console.error("[listing-lookup] Supabase query failed", {
                column, value, attempt, status, code: result.error.code,
                message: result.error.message, retryable,
            })
            if (!retryable || attempt === MAX_ATTEMPTS) {
                throw new ListingLookupError(column, value, result.error.message)
            }
        } catch (error) {
            if (error instanceof ListingLookupError) throw error
            console.error("[listing-lookup] Network failure", {
                column, value, attempt,
                message: error instanceof Error ? error.message : String(error),
            })
            if (attempt === MAX_ATTEMPTS) {
                throw new ListingLookupError(column, value, "Supabase unavailable")
            }
        } finally {
            clearTimeout(timer)
        }
        await wait(150 * 2 ** (attempt - 1))
    }
    throw new ListingLookupError(column, value, "Supabase retry limit reached")
}

export class ListingLookupError extends Error {
    constructor(column: string, value: string, reason: string) {
        super(`Listing lookup failed (${column}=${value}): ${reason}`)
        this.name = "ListingLookupError"
    }
}

export const getListingBySlug = cache(
    async (slug: string): Promise<TeleHubListing | null> => {
        const clean = cleanSlug(slug)
        if (!clean) return null

        const byShortInvite = await lookup("short_invite", clean)
        if (byShortInvite) return byShortInvite

        // Only fall back when the first query successfully returned no record.
        // An upstream error must never be mistaken for a missing listing.
        return lookup("slug", slug)
    }
)

export function getListingName(listing: TeleHubListing) {
    return listing.channel_name || listing.telegram_title || "Telegram Listing"
}

export function getListingType(listing: TeleHubListing) {
    return String(listing.listing_type || "channel").toLowerCase()
}

export function getCategories(listing: TeleHubListing) {
    if (Array.isArray(listing.categories)) return listing.categories.filter(Boolean)
    if (typeof listing.categories === "string") {
        return listing.categories.split(",").map((category) => category.trim()).filter(Boolean)
    }
    return ["General"]
}

export function getShortDescription(listing: TeleHubListing) {
    const name = getListingName(listing)
    return listing.description || listing.telegram_description || `View ${name} on TeleHub.`
}

export function getLongDescription(listing: TeleHubListing) {
    const name = getListingName(listing)
    const type = getListingType(listing)
    return listing.long_description || listing.telegram_description || listing.description ||
        `${name} is a Telegram ${type} listed on TeleHub.`
}

export function getTelegramUsername(listing: TeleHubListing) {
    if (listing.telegram_username) {
        return listing.telegram_username.startsWith("@")
            ? listing.telegram_username : `@${listing.telegram_username}`
    }
    if (listing.telegram_link) {
        const match = listing.telegram_link.match(/t\.me\/([^/?]+)/i)
        if (match?.[1] && !match[1].startsWith("+")) return `@${match[1]}`
    }
    return ""
}

export function getSeoTitle(listing: TeleHubListing) {
    const name = getListingName(listing)
    const type = getListingType(listing)
    const typeTitle = type.charAt(0).toUpperCase() + type.slice(1)
    return `${name} Telegram ${typeTitle}`
}

export function getSeoDescription(listing: TeleHubListing) {
    const name = getListingName(listing)
    return `View ${name} on TeleHub, including its Telegram link, description, category, member count, and listing details.`
}
