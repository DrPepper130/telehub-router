import { createClient } from "@supabase/supabase-js"
import { cache } from "react"

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

export const getListingBySlug = cache(
    async (slug: string): Promise<TeleHubListing | null> => {
        const clean = cleanSlug(slug)

        if (!clean) return null

        const byShortInvite = await supabase
            .from("channel_listings")
            .select("*")
            .eq("status", "approved")
            .or("is_banned.is.null,is_banned.eq.false")
            .eq("short_invite", clean)
            .maybeSingle()

        if (byShortInvite.error) {
            console.error(
                "Supabase short_invite lookup failed:",
                byShortInvite.error
            )
        }

        if (byShortInvite.data) {
            return byShortInvite.data as TeleHubListing
        }

        const bySlug = await supabase
            .from("channel_listings")
            .select("*")
            .eq("status", "approved")
            .or("is_banned.is.null,is_banned.eq.false")
            .eq("slug", slug)
            .maybeSingle()

        if (bySlug.error) {
            console.error("Supabase slug lookup failed:", bySlug.error)
        }

        return (bySlug.data as TeleHubListing | null) || null
    }
)

export function getListingName(listing: TeleHubListing) {
    return (
        listing.channel_name ||
        listing.telegram_title ||
        "Telegram Listing"
    )
}

export function getListingType(listing: TeleHubListing) {
    return String(listing.listing_type || "channel").toLowerCase()
}

export function getCategories(listing: TeleHubListing) {
    if (Array.isArray(listing.categories)) {
        return listing.categories.filter(Boolean)
    }

    if (typeof listing.categories === "string") {
        return listing.categories
            .split(",")
            .map((category) => category.trim())
            .filter(Boolean)
    }

    return ["General"]
}

export function getShortDescription(listing: TeleHubListing) {
    const name = getListingName(listing)

    return (
        listing.description ||
        listing.telegram_description ||
        `View ${name} on TeleHub.`
    )
}

export function getLongDescription(listing: TeleHubListing) {
    const name = getListingName(listing)
    const type = getListingType(listing)

    return (
        listing.long_description ||
        listing.telegram_description ||
        listing.description ||
        `${name} is a Telegram ${type} listed on TeleHub.`
    )
}

export function getTelegramUsername(listing: TeleHubListing) {
    if (listing.telegram_username) {
        return listing.telegram_username.startsWith("@")
            ? listing.telegram_username
            : `@${listing.telegram_username}`
    }

    if (listing.telegram_link) {
        const match = listing.telegram_link.match(/t\.me\/([^/?]+)/i)

        if (match?.[1] && !match[1].startsWith("+")) {
            return `@${match[1]}`
        }
    }

    return ""
}

export function getSeoTitle(listing: TeleHubListing) {
    const name = getListingName(listing)
    const type = getListingType(listing)
    const typeTitle =
        type.charAt(0).toUpperCase() + type.slice(1)

    return `${name} Telegram ${typeTitle}`
}

export function getSeoDescription(listing: TeleHubListing) {
    const name = getListingName(listing)

    return `View ${name} on TeleHub, including its Telegram link, description, category, member count, and listing details.`
}
