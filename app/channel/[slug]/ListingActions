"use client"

import { createClient } from "@supabase/supabase-js"
import { useEffect, useMemo, useState } from "react"

const BACKEND_URL = "https://telegramboard.onrender.com"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Props = {
    listingId: string
    listingSlug: string
    listingName: string
    shortInvite: string
    initialVotes: number
    telegramLink: string
    memberCount: number
    categories: string[]
    iconUrl?: string | null
    imageUrl?: string | null
    description?: string | null
}

function favoriteId(item: any) {
    return String(
        item?.listing_id ||
            item?.listingId ||
            item?.id ||
            item?.listing?.id ||
            ""
    )
}

export default function ListingActions({
    listingId,
    listingSlug,
    listingName,
    shortInvite,
    initialVotes,
    telegramLink,
    memberCount,
    categories,
    iconUrl,
    imageUrl,
    description,
}: Props) {
    const [votes, setVotes] = useState(initialVotes)
    const [loading, setLoading] = useState(true)
    const [voting, setVoting] = useState(false)
    const [alreadyVoted, setAlreadyVoted] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [favorited, setFavorited] = useState(false)
    const [saving, setSaving] = useState(false)

    const listingUrl = useMemo(
        () =>
            `https://telehub.to/channel/${encodeURIComponent(shortInvite)}`,
        [shortInvite]
    )

    useEffect(() => {
        let cancelled = false

        async function loadState() {
            try {
                const { data } = await supabase.auth.getSession()
                const session = data.session

                if (!session) return

                const [adminResult, favoritesResult] = await Promise.all([
                    fetch(`${BACKEND_URL}/api/auth/is-admin`, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }),
                    fetch(`${BACKEND_URL}/api/profile/favorites`, {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }),
                ])

                if (adminResult.ok) {
                    const adminData = await adminResult
                        .json()
                        .catch(() => ({}))
                    if (!cancelled) {
                        setIsAdmin(Boolean(adminData?.isAdmin))
                    }
                }

                if (favoritesResult.ok) {
                    const favoriteData = await favoritesResult
                        .json()
                        .catch(() => ({}))
                    const favorites = Array.isArray(favoriteData?.favorites)
                        ? favoriteData.favorites
                        : []

                    if (!cancelled) {
                        setFavorited(
                            favorites.some(
                                (item: any) =>
                                    favoriteId(item) === listingId
                            )
                        )
                    }
                }

                const cutoff = new Date(
                    Date.now() - 24 * 60 * 60 * 1000
                ).toISOString()

                const { data: recentVote } = await supabase
                    .from("channel_votes")
                    .select("id, created_at")
                    .eq("user_id", session.user.id)
                    .gte("created_at", cutoff)
                    .limit(1)
                    .maybeSingle()

                if (!cancelled) {
                    setAlreadyVoted(Boolean(recentVote))
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadState()

        return () => {
            cancelled = true
        }
    }, [listingId])

    async function vote() {
        if (loading || voting) return

        const { data } = await supabase.auth.getSession()
        const session = data.session

        if (!session) {
            window.location.href = "/login"
            return
        }

        if (!isAdmin && alreadyVoted) return

        setVoting(true)

        try {
            if (!isAdmin) {
                const cutoff = new Date(
                    Date.now() - 24 * 60 * 60 * 1000
                ).toISOString()

                const { data: recentVote } = await supabase
                    .from("channel_votes")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .gte("created_at", cutoff)
                    .limit(1)
                    .maybeSingle()

                if (recentVote) {
                    setAlreadyVoted(true)
                    return
                }
            }

            const { error } = await supabase
                .from("channel_votes")
                .insert({
                    user_id: session.user.id,
                    listing_id: listingId,
                })

            if (error) throw error

            const nextVotes = votes + 1

            setVotes(nextVotes)
            if (!isAdmin) setAlreadyVoted(true)

            fetch(`${BACKEND_URL}/api/discord/vote-feed`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: listingName,
                    description:
                        description ||
                        "A Telegram community was recently voted on TeleHub.",
                    telegram_link: telegramLink,
                    listing_url: listingUrl,
                    icon_url: iconUrl,
                    image_url: imageUrl,
                    votes_count: nextVotes,
                    member_count: memberCount,
                    categories,
                }),
            }).catch(() => {})
        } catch (error) {
            console.error("Vote failed:", error)
        } finally {
            setVoting(false)
        }
    }

    async function toggleFavorite() {
        if (loading || saving) return

        const { data } = await supabase.auth.getSession()
        const session = data.session

        if (!session) {
            window.location.href = "/login"
            return
        }

        const previous = favorited
        const next = !previous

        setFavorited(next)
        setSaving(true)

        try {
            if (next) {
                const payloads = [
                    {
                        listing_id: listingId,
                        listingId,
                        slug: listingSlug || undefined,
                    },
                    { listing_id: listingId },
                    { listingId },
                ]

                let success = false
                let lastError = "Could not save favorite."

                for (const payload of payloads) {
                    const response = await fetch(
                        `${BACKEND_URL}/api/profile/favorites/toggle`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify(payload),
                        }
                    )

                    if (response.ok) {
                        success = true
                        break
                    }

                    const responseData = await response
                        .json()
                        .catch(() => ({}))

                    lastError =
                        responseData?.error ||
                        response.statusText ||
                        lastError
                }

                if (!success) throw new Error(lastError)
            } else {
                const response = await fetch(
                    `${BACKEND_URL}/api/profile/favorites/${encodeURIComponent(
                        listingId
                    )}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                    }
                )

                if (!response.ok) {
                    const responseData = await response
                        .json()
                        .catch(() => ({}))

                    throw new Error(
                        responseData?.error ||
                            "Could not remove favorite."
                    )
                }
            }
        } catch (error) {
            console.error("Favorite action failed:", error)
            setFavorited(previous)
        } finally {
            setSaving(false)
        }
    }

    const voteDisabled =
        loading || voting || (!isAdmin && alreadyVoted)

    return (
        <>
            <button
                type="button"
                className="listingVoteCard"
                onClick={vote}
                disabled={voteDisabled}
                title={
                    loading
                        ? "Loading votes..."
                        : !isAdmin && alreadyVoted
                          ? "You can vote again after 24 hours"
                          : isAdmin
                            ? "Admin vote"
                            : "Vote"
                }
                aria-label={
                    isAdmin ? "Admin vote" : "Vote for this listing"
                }
            >
                <span>VOTES</span>
                <strong>{votes.toLocaleString()}</strong>
            </button>

            <button
                type="button"
                className={`favoriteButton${
                    favorited ? " isSaved" : ""
                }`}
                onClick={toggleFavorite}
                disabled={loading || saving}
                title={
                    favorited
                        ? "Remove from favorites"
                        : "Save to favorites"
                }
                aria-label={
                    favorited
                        ? "Remove from favorites"
                        : "Save to favorites"
                }
            >
                <span aria-hidden="true">
                    {favorited ? "★" : "☆"}
                </span>
                <span>
                    {saving
                        ? "Saving…"
                        : favorited
                          ? "Saved"
                          : "Save"}
                </span>
            </button>
        </>
    )
}
