import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"

import BackToListings from "./BackToListings"
import ListingActions from "./ListingActions"
import SiteHeader from "./SiteHeader"
import styles from "./ListingActionLayout.module.css"

import {
    getCategories,
    getListingBySlug,
    getListingName,
    getListingType,
    getLongDescription,
    getShortDescription,
    getTelegramUsername,
} from "@/lib/listings"

type PageProps = {
    params: Promise<{
        slug: string
    }>
}

function compactNumber(value: number | null | undefined) {
    const number = Number(value || 0)

    if (number >= 1_000_000) {
        const scaled = number / 1_000_000
        return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}M`
    }

    if (number >= 1_000) {
        const scaled = number / 1_000
        return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}K`
    }

    return number.toLocaleString()
}


const TELEGRAMBOARD_URL = "https://telegramboard.onrender.com"

type ListingAnalytics = {
    ok?: boolean
    slug?: string
    listing_id?: string
    current_members?: number
    statistics_updated_at?: string | null
    growth?: {
        day_1?: GrowthStat
        day_7?: GrowthStat
        day_30?: GrowthStat
    }
    member_history?: Array<{
        member_count: number
        created_at: string
    }>
    activity?: {
        available?: boolean
        latest_post_at?: string | null
        posts_observed_last_7_days?: number
        average_observed_posts_per_day?: number
        public_preview_post_count?: number
        source?: string | null
        warning?: string | null
        error?: string | null
    }
    network?: {
        available?: boolean
        linked_communities?: number
        channels_linking_here?: number
        edge_storage_available?: boolean
        related_communities?: Array<{
            id: string
            short_invite?: string | null
            name?: string | null
            username?: string | null
            member_count?: number
            icon_url?: string | null
            listing_type?: string | null
            matching_tags?: string[]
            matching_tag_count?: number
        }>
    }
    growth_available?: boolean
    recent_posts?: string[]
}

type GrowthStat = {
    days?: number
    change?: number | null
    percent?: number | null
    baseline_members?: number | null
    baseline_at?: string | null
}

async function getListingAnalytics(
    slug: string
): Promise<ListingAnalytics | null> {
    const normalizedSlug = String(slug || "").trim()
    if (!normalizedSlug) return null

    try {
        const response = await fetch(
            `${TELEGRAMBOARD_URL}/api/public/listing-analytics?slug=${encodeURIComponent(
                normalizedSlug
            )}`,
            {
                next: { revalidate: 3600 },
            }
        )

        if (!response.ok) return null

        const payload = (await response.json()) as ListingAnalytics
        return payload?.ok ? payload : null
    } catch {
        return null
    }
}


function signedNumber(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return "—"
    }

    const number = Number(value)
    if (number === 0) return "0"
    return `${number > 0 ? "+" : ""}${number.toLocaleString()}`
}

function growthText(stat: GrowthStat | null | undefined) {
    if (!stat || stat.change === null || stat.change === undefined) return "—"

    const percent =
        stat.percent === null || stat.percent === undefined
            ? ""
            : ` (${stat.percent > 0 ? "+" : ""}${Number(stat.percent).toFixed(1)}%)`

    return `${signedNumber(stat.change)}${percent}`
}

function formatUpdatedDate(value: string | null | undefined) {
    if (!value) return "Unknown"

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Unknown"

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })
}

function formatRelativeTime(value: string | null | undefined) {
    if (!value) return "Unavailable"

    const timestamp = new Date(value).getTime()
    if (!Number.isFinite(timestamp)) return "Unavailable"

    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
    if (seconds < 60) return "Less than a minute ago"

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

    const days = Math.floor(hours / 24)
    return `${days} day${days === 1 ? "" : "s"} ago`
}

function MemberGrowthChart({
    history,
}: {
    history: Array<{ member_count: number; created_at: string }>
}) {
    const points = (history || [])
        .map((item) => ({
            value: Number(item.member_count || 0),
            time: new Date(item.created_at).getTime(),
        }))
        .filter(
            (item) =>
                Number.isFinite(item.value) &&
                Number.isFinite(item.time)
        )

    if (points.length < 2) {
        return (
            <div
                style={{
                    border: "1px solid rgba(15, 23, 42, 0.12)",
                    borderRadius: 16,
                    padding: 20,
                    color: "#64748b",
                    background: "rgba(255,255,255,0.62)",
                }}
            >
                More member snapshots are needed before the growth chart can be shown.
            </div>
        )
    }

    const values = points.map((point) => point.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const spread = Math.max(1, max - min)
    const width = 900
    const height = 260
    const padX = 28
    const padY = 24

    const path = points
        .map((point, index) => {
            const x =
                padX +
                (index / Math.max(1, points.length - 1)) *
                    (width - padX * 2)
            const y =
                height -
                padY -
                ((point.value - min) / spread) *
                    (height - padY * 2)

            return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
        })
        .join(" ")

    return (
        <div
            style={{
                overflow: "hidden",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                borderRadius: 16,
                background: "rgba(255,255,255,0.72)",
            }}
        >
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Telegram member growth history"
                style={{ display: "block", width: "100%", height: "auto" }}
            >
                <line
                    x1={padX}
                    x2={width - padX}
                    y1={height - padY}
                    y2={height - padY}
                    stroke="rgba(15,23,42,0.12)"
                />
                <line
                    x1={padX}
                    x2={width - padX}
                    y1={padY}
                    y2={padY}
                    stroke="rgba(15,23,42,0.08)"
                />
                <path
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "0 18px 16px",
                    fontSize: 13,
                    color: "#64748b",
                }}
            >
                <span>{compactNumber(points[0].value)}</span>
                <span>{compactNumber(points[points.length - 1].value)}</span>
            </div>
        </div>
    )
}

function AnalyticsStat({
    label,
    value,
}: {
    label: string
    value: ReactNode
}) {
    return (
        <div
            style={{
                padding: "16px 18px",
                borderRadius: 14,
                border: "1px solid rgba(15, 23, 42, 0.1)",
                background: "rgba(255,255,255,0.68)",
            }}
        >
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "#64748b",
                    marginBottom: 6,
                }}
            >
                {label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
        </div>
    )
}


export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { slug } = await params
    const listing = await getListingBySlug(slug)

    if (!listing) {
        return {
            title: "Listing Not Found",
            robots: {
                index: false,
                follow: false,
            },
        }
    }

    const canonicalSlug = String(listing.short_invite || slug)
    const listingAnalytics = await getListingAnalytics(canonicalSlug)
    const name = getListingName(listing)
    const listingType = getListingType(listing)
    const members = Number(listing.member_count || 0)

    const growth30 = listingAnalytics?.growth?.day_30
    const hasGrowth =
        growth30?.change !== null &&
        growth30?.change !== undefined

    const title = `${name} Telegram ${
        listingType === "group" ? "Group " : ""
    }– Members${hasGrowth ? ", Growth" : ""} & Statistics`

    const growthPhrase =
        growth30?.change !== null &&
        growth30?.change !== undefined
            ? `, ${signedNumber(growth30.change)} members over 30 days`
            : ""

    const analyticsBits = [
        listingAnalytics?.activity?.available ? "recent activity" : null,
        listingAnalytics?.growth_available ? "growth history" : null,
        listingAnalytics?.network?.related_communities?.length
            ? "related communities"
            : null,
    ].filter(Boolean)

    const description = `View ${name} Telegram statistics including ${members.toLocaleString()} members${growthPhrase}${
        analyticsBits.length ? `, ${analyticsBits.join(", ")}` : ""
    } and channel information.`

    const canonical = `https://telehub.to/channel/${canonicalSlug}`

    return {
        title,
        description,
        alternates: {
            canonical,
        },
        openGraph: {
            type: "website",
            url: canonical,
            title,
            description,
            images: listing.icon_url
                ? [
                      {
                          url: listing.icon_url,
                      },
                  ]
                : [],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: listing.icon_url ? [listing.icon_url] : [],
        },
    }
}

export default async function ChannelPage({ params }: PageProps) {
    const { slug } = await params
    const listing = await getListingBySlug(slug)

    if (!listing) {
        notFound()
    }

    const name = getListingName(listing)
    const listingType = getListingType(listing)
    const categories = getCategories(listing)
    const categoryText = categories.join(", ")
    const shortDescription = getShortDescription(listing)
    const longDescription = getLongDescription(listing)
    const username = getTelegramUsername(listing)

    const members = Number(listing.member_count || 0)
    const votes = Number(listing.votes_count || 0)
    const rank = String(listing.paid_rank || "free").toLowerCase()
    const status = String(listing.status || "approved").toLowerCase()
    const isNsfw = Boolean(listing.is_nsfw)

    const canonicalSlug = String(listing.short_invite || slug)
    const listingAnalytics = await getListingAnalytics(canonicalSlug)
    const joinUrl =
        listing.telegram_link ||
        (username
            ? `https://t.me/${username.replace(/^@/, "")}`
            : "#")

    const hasActivity = Boolean(listingAnalytics?.activity?.available)
    const hasGrowth =
        Boolean(listingAnalytics?.growth_available) &&
        (listingAnalytics?.member_history?.length || 0) >= 2
    const hasNetwork = Boolean(listingAnalytics?.network?.available)
    const hasRelated =
        (listingAnalytics?.network?.related_communities?.length || 0) > 0
    const hasRecentPosts = (listingAnalytics?.recent_posts?.length || 0) > 0
    const hasAnyAnalytics =
        hasActivity || hasGrowth || hasNetwork || hasRelated || hasRecentPosts

    const backgroundStyle = listing.image_url
        ? {
              backgroundImage: `
                linear-gradient(
                    rgba(255,255,255,0.78),
                    rgba(255,255,255,0.78)
                ),
                url("${listing.image_url}")
              `,
          }
        : listing.icon_url
          ? {
                backgroundImage: `
                    linear-gradient(
                        rgba(255,255,255,0.84),
                        rgba(255,255,255,0.84)
                    ),
                    url("${listing.icon_url}")
                `,
            }
          : undefined

    return (
        <div className="listingPage">
            <a className="promoBanner" href="/widgets">
                <span>Are You a Website Owner? Use Our Free Website Embeds</span>
                <span className="promoCopyIcon" aria-hidden="true">▢</span>
            </a>

            <SiteHeader />

            <main
                className="listingBackground"
                style={backgroundStyle}
            >
                <div className="listingShell">
                    <BackToListings />

                    <section className="overviewCard">
                        <div className="overviewHeader">
                            <div className="listingIconFrame">
                                {listing.icon_url ? (
                                    <img
                                        src={listing.icon_url}
                                        alt={`${name} listing icon`}
                                        className="listingIcon"
                                    />
                                ) : (
                                    <div className="listingIconFallback">✈</div>
                                )}
                            </div>

                            <div className="overviewCopy">
                                <div className="listingBadges">
                                    <span className="listingTypeBadge">
                                        {listingType}
                                    </span>
                                    <span className="categoryBadge">
                                        {categoryText || "General"}
                                    </span>
                                    {isNsfw ? (
                                        <span className="nsfwBadge">NSFW</span>
                                    ) : null}
                                </div>

                                <h1>{name}</h1>
                                <p className="heroDescription">
                                    {shortDescription}
                                </p>
                            </div>
                        </div>

                        <div
                            className={`overviewActions ${styles.mobileJoinOrder}`}
                        >
                            <div className="usernameCard">
                                <span>TELEGRAM USERNAME</span>
                                <strong>{username || "—"}</strong>
                            </div>

                            <div
                                className="memberCard"
                                title={
                                    listing.last_synced_at
                                        ? `Last updated ${new Date(
                                              listing.last_synced_at
                                          ).toLocaleString()}`
                                        : undefined
                                }
                            >
                                <span>MEMBERS</span>
                                <strong>{compactNumber(members)}</strong>
                            </div>

                            <ListingActions
                                listingId={listing.id}
                                listingSlug={String(listing.slug || "")}
                                listingName={name}
                                shortInvite={canonicalSlug}
                                initialVotes={votes}
                                telegramLink={joinUrl}
                                memberCount={members}
                                categories={categories}
                                iconUrl={listing.icon_url}
                                imageUrl={listing.image_url}
                                description={longDescription}
                            />

                            <a
                                className="joinButton"
                                href={joinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Join Telegram
                            </a>
                        </div>
                    </section>

                    <section className="contentGrid">
                        <article className="contentCard">
                            <h2>About this listing</h2>
                            <p>
                                {name} is a Telegram {listingType} listed on
                                TeleHub. View its description, category, member
                                count, and Telegram join link.
                            </p>
                        </article>

                        <article className="contentCard descriptionCard">
                            <h2>Description</h2>
                            <p>{longDescription}</p>
                        </article>
                    </section>

                    {listingAnalytics && hasAnyAnalytics ? (
                        <section
                            className="detailsCard"
                            style={{ display: "grid", gap: 24 }}
                        >
                            <div>
                                <h2 style={{ marginBottom: 6 }}>Telegram statistics</h2>
                                <p style={{ margin: 0, color: "#64748b" }}>
                                    Statistics updated {formatUpdatedDate(
                                        listingAnalytics.statistics_updated_at
                                    )}
                                </p>
                            </div>

                            {hasActivity ? (
                            <div>
                                <h3 style={{ marginBottom: 12 }}>Activity</h3>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "repeat(auto-fit, minmax(170px, 1fr))",
                                        gap: 12,
                                    }}
                                >
                                    <AnalyticsStat
                                        label="Last public post"
                                        value={formatRelativeTime(
                                            listingAnalytics.activity?.latest_post_at
                                        )}
                                    />
                                    <AnalyticsStat
                                        label="Recent posts (7d)"
                                        value={
                                            listingAnalytics.activity
                                                ?.posts_observed_last_7_days ?? "—"
                                        }
                                    />
                                    <AnalyticsStat
                                        label="Average posts/day"
                                        value={
                                            listingAnalytics.activity
                                                ?.average_observed_posts_per_day ?? "—"
                                        }
                                    />
                                </div>
                                {listingAnalytics.activity?.warning ? (
                                    <p
                                        style={{
                                            margin: "10px 0 0",
                                            fontSize: 12,
                                            color: "#64748b",
                                        }}
                                    >
                                        {listingAnalytics.activity.warning}
                                    </p>
                                ) : null}
                            </div>
                            ) : null}

                            {hasGrowth ? (
                            <div>
                                <h3 style={{ marginBottom: 12 }}>Member growth</h3>
                                <MemberGrowthChart
                                    history={listingAnalytics.member_history || []}
                                />
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "repeat(auto-fit, minmax(150px, 1fr))",
                                        gap: 12,
                                        marginTop: 12,
                                    }}
                                >
                                    <AnalyticsStat
                                        label="24 hours"
                                        value={growthText(
                                            listingAnalytics.growth?.day_1
                                        )}
                                    />
                                    <AnalyticsStat
                                        label="7 days"
                                        value={growthText(
                                            listingAnalytics.growth?.day_7
                                        )}
                                    />
                                    <AnalyticsStat
                                        label="30 days"
                                        value={growthText(
                                            listingAnalytics.growth?.day_30
                                        )}
                                    />
                                </div>
                            </div>
                            ) : null}

                            {hasNetwork ? (
                            <div>
                                <h3 style={{ marginBottom: 12 }}>
                                    Telegram network
                                </h3>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "repeat(auto-fit, minmax(170px, 1fr))",
                                        gap: 12,
                                    }}
                                >
                                    <AnalyticsStat
                                        label="Linked communities"
                                        value={
                                            listingAnalytics.network
                                                ?.linked_communities ?? 0
                                        }
                                    />
                                    <AnalyticsStat
                                        label="Channels linking here"
                                        value={
                                            listingAnalytics.network
                                                ?.channels_linking_here ?? 0
                                        }
                                    />
                                </div>
                            </div>
                            ) : null}

                            {hasRelated ? (
                                <div>
                                    <h3 style={{ marginBottom: 12 }}>
                                        Related communities
                                    </h3>

                                    <div className="relatedCommunityGrid">
                                        {(listingAnalytics.network?.related_communities || []).map(
                                            (related) => (
                                                <a
                                                    key={related.id}
                                                    href={`/channel/${related.short_invite}`}
                                                    className="relatedCommunityCard"
                                                >
                                                    {related.icon_url ? (
                                                        <img
                                                            src={related.icon_url}
                                                            alt=""
                                                            width={44}
                                                            height={44}
                                                            className="relatedCommunityIcon"
                                                        />
                                                    ) : (
                                                        <div className="relatedCommunityIcon relatedCommunityIconFallback">
                                                            {(related.name ||
                                                                related.username ||
                                                                "T")
                                                                .slice(0, 1)
                                                                .toUpperCase()}
                                                        </div>
                                                    )}

                                                    <span className="relatedCommunityCopy">
                                                        <strong>
                                                            {related.name ||
                                                                related.username ||
                                                                "Telegram community"}
                                                        </strong>
                                                        <small>
                                                            {compactNumber(
                                                                related.member_count
                                                            )}{" "}
                                                            members
                                                        </small>
                                                    </span>
                                                </a>
                                            )
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {hasRecentPosts ? (
                                <div>
                                    <h3 style={{ marginBottom: 12 }}>
                                        Recent public posts
                                    </h3>

                                    <div className="telegramPostGrid">
                                        {(listingAnalytics.recent_posts || []).map(
                                            (rawPost, index) => {
                                                const postText = String(
                                                    rawPost || ""
                                                ).trim()

                                                if (!postText) return null

                                                return (
                                                    <article
                                                        key={`${index}-${postText.slice(
                                                            0,
                                                            32
                                                        )}`}
                                                        className="telegramPostCard"
                                                    >
                                                        <div className="telegramPostHeader">
                                                            <div className="telegramPostIdentity">
                                                                {listing.icon_url ? (
                                                                    <img
                                                                        src={listing.icon_url}
                                                                        alt=""
                                                                        width={40}
                                                                        height={40}
                                                                        className="telegramPostAvatar"
                                                                    />
                                                                ) : (
                                                                    <div className="telegramPostAvatar telegramPostAvatarFallback">
                                                                        {name
                                                                            .slice(
                                                                                0,
                                                                                1
                                                                            )
                                                                            .toUpperCase()}
                                                                    </div>
                                                                )}

                                                                <div className="telegramPostIdentityCopy">
                                                                    <strong>
                                                                        {name}
                                                                    </strong>
                                                                    {username ? (
                                                                        <span>
                                                                            {username.startsWith(
                                                                                "@"
                                                                            )
                                                                                ? username
                                                                                : `@${username}`}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>

                                                            <span
                                                                className="telegramPostMenu"
                                                                aria-hidden="true"
                                                            >
                                                                •••
                                                            </span>
                                                        </div>

                                                        <div className="telegramPostBody">
                                                            <p>{postText}</p>
                                                        </div>

                                                        <div className="telegramPostFooter">
                                                            <span>
                                                                Public Telegram post
                                                            </span>
                                                            <a
                                                                href={joinUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                Open Telegram ↗
                                                            </a>
                                                        </div>
                                                    </article>
                                                )
                                            }
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <style>{`
                                .relatedCommunityGrid {
                                    display: grid;
                                    grid-template-columns: repeat(4, minmax(0, 1fr));
                                    gap: 12px;
                                }

                                .relatedCommunityCard {
                                    min-width: 0;
                                    min-height: 92px;
                                    display: flex;
                                    align-items: center;
                                    gap: 12px;
                                    padding: 14px;
                                    border-radius: 14px;
                                    border: 1px solid rgba(15, 23, 42, 0.1);
                                    background: rgba(255, 255, 255, 0.72);
                                    text-decoration: none;
                                    color: inherit;
                                    box-sizing: border-box;
                                    overflow: hidden;
                                }

                                .relatedCommunityIcon {
                                    width: 44px;
                                    height: 44px;
                                    min-width: 44px;
                                    flex: 0 0 44px;
                                    border-radius: 12px;
                                    object-fit: cover;
                                }

                                .relatedCommunityIconFallback {
                                    display: grid;
                                    place-items: center;
                                    background: rgba(44, 116, 244, 0.1);
                                    color: #2c74f4;
                                    font-weight: 800;
                                }

                                .relatedCommunityCopy {
                                    min-width: 0;
                                    display: block;
                                }

                                .relatedCommunityCopy strong {
                                    display: -webkit-box;
                                    min-width: 0;
                                    overflow: hidden;
                                    -webkit-box-orient: vertical;
                                    -webkit-line-clamp: 2;
                                    line-clamp: 2;
                                    line-height: 1.2;
                                    overflow-wrap: anywhere;
                                }

                                .relatedCommunityCopy small {
                                    display: block;
                                    margin-top: 5px;
                                    color: #64748b;
                                    white-space: nowrap;
                                }

                                .telegramPostGrid {
                                    display: grid;
                                    grid-template-columns: repeat(3, minmax(0, 1fr));
                                    gap: 12px;
                                }

                                .telegramPostCard {
                                    min-width: 0;
                                    display: flex;
                                    flex-direction: column;
                                    overflow: hidden;
                                    border-radius: 16px;
                                    border: 1px solid rgba(15, 23, 42, 0.11);
                                    background: rgba(255, 255, 255, 0.82);
                                    box-shadow: 0 8px 24px rgba(18, 42, 82, 0.04);
                                }

                                .telegramPostHeader {
                                    display: flex;
                                    align-items: center;
                                    justify-content: space-between;
                                    gap: 12px;
                                    padding: 14px 15px 12px;
                                    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
                                }

                                .telegramPostIdentity {
                                    min-width: 0;
                                    display: flex;
                                    align-items: center;
                                    gap: 10px;
                                }

                                .telegramPostAvatar {
                                    width: 40px;
                                    height: 40px;
                                    min-width: 40px;
                                    border-radius: 999px;
                                    object-fit: cover;
                                }

                                .telegramPostAvatarFallback {
                                    display: grid;
                                    place-items: center;
                                    background: rgba(44, 116, 244, 0.1);
                                    color: #2c74f4;
                                    font-weight: 800;
                                }

                                .telegramPostIdentityCopy {
                                    min-width: 0;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 2px;
                                }

                                .telegramPostIdentityCopy strong,
                                .telegramPostIdentityCopy span {
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                    white-space: nowrap;
                                }

                                .telegramPostIdentityCopy span {
                                    color: #64748b;
                                    font-size: 12px;
                                }

                                .telegramPostMenu {
                                    color: #64748b;
                                    font-weight: 800;
                                    letter-spacing: 1px;
                                    flex: 0 0 auto;
                                }

                                .telegramPostBody {
                                    flex: 1;
                                    min-width: 0;
                                    padding: 16px;
                                }

                                .telegramPostBody p {
                                    margin: 0;
                                    line-height: 1.55;
                                    white-space: pre-wrap;
                                    overflow-wrap: anywhere;
                                    display: -webkit-box;
                                    -webkit-box-orient: vertical;
                                    -webkit-line-clamp: 8;
                                    line-clamp: 8;
                                    overflow: hidden;
                                }

                                .telegramPostFooter {
                                    display: flex;
                                    align-items: center;
                                    justify-content: space-between;
                                    gap: 12px;
                                    padding: 11px 15px 13px;
                                    border-top: 1px solid rgba(15, 23, 42, 0.08);
                                    color: #64748b;
                                    font-size: 12px;
                                }

                                .telegramPostFooter a {
                                    color: #2c74f4;
                                    text-decoration: none;
                                    font-weight: 700;
                                    white-space: nowrap;
                                }

                                @media (max-width: 900px) {
                                    .relatedCommunityGrid {
                                        grid-template-columns: repeat(2, minmax(0, 1fr));
                                    }

                                    .telegramPostGrid {
                                        grid-template-columns: 1fr;
                                    }
                                }

                                @media (max-width: 560px) {
                                    .relatedCommunityGrid {
                                        grid-template-columns: 1fr;
                                    }

                                    .relatedCommunityCard {
                                        min-height: 76px;
                                    }

                                    .telegramPostFooter {
                                        align-items: flex-start;
                                        flex-direction: column;
                                    }
                                }
                            `}</style>
                        </section>
                    ) : null}

                    <section className="detailsCard">
                        <h2>Listing details</h2>

                        <div className="detailsGrid">
                            <Detail
                                label="MEMBERS"
                                value={compactNumber(members)}
                            />
                            <Detail
                                label="VOTES"
                                value={votes.toLocaleString()}
                            />
                            <Detail label="RANK" value={rank} />
                            <Detail label="STATUS" value={status} />
                        </div>

                        <div className="technicalDetails">
                            <span>{listing.slug || canonicalSlug}</span>
                            <span>{listing.id}</span>
                        </div>
                    </section>

                    <section className="safetyCard">
                        <h2>Safety and reporting</h2>
                        <p>
                            TeleHub helps users discover Telegram communities,
                            but users should review each community before
                            joining. Report misleading, unsafe, or inappropriate
                            listings.
                        </p>
                        <a className="reportButton" href="/report">
                            Report a listing
                        </a>
                    </section>

                    <section className="faqSection">
                        <h2>FAQ</h2>

                        <Faq
                            question={`How do I join ${name}?`}
                            answer={`Click the join button to open ${name} on Telegram.`}
                        />

                        <Faq
                            question={`Is ${name} NSFW?`}
                            answer={
                                isNsfw
                                    ? `Yes, ${name} is marked as NSFW. Review the community carefully before joining.`
                                    : `No, ${name} is not marked as NSFW. Users should still review the community before joining.`
                            }
                        />

                        <Faq
                            question={`What category is ${name} in?`}
                            answer={`${name} is listed under ${
                                categoryText || "General"
                            } on TeleHub.`}
                        />
                    </section>

                    <div className="internalLinks">
                        <a href="/">Back to TeleHub</a>
                        <a
                            href={
                                listingType === "group"
                                    ? "/groups"
                                    : "/channels"
                            }
                        >
                            Browse directory
                        </a>
                    </div>
                </div>
            </main>

            <footer className="siteFooter">
                <div className="footerColumns">
                    <div>
                        <h3>Community</h3>
                        <a
                            href="https://t.me/telehubadvertise"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Our Telegram
                        </a>
                        <a href="/channels">Telegram Channels</a>
                        <a href="/groups">Telegram Groups</a>
                        <a href="/blog">Blog</a>
                    </div>

                    <div>
                        <h3>Safety</h3>
                        <a href="/guidelines">Guidelines</a>
                        <a href="/moderation">Moderation Policy</a>
                        <a href="/report">Report a Listing</a>
                    </div>

                    <div>
                        <h3>Company</h3>
                        <a href="/about">About</a>
                        <a
                            href="https://discord.gg/BsS9rzfP87"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Contact
                        </a>
                    </div>

                    <div>
                        <h3>Legal</h3>
                        <a href="/privacy">Privacy</a>
                        <a href="/terms">Terms</a>
                    </div>
                </div>

                <div className="footerBottom">
                    <h3>Advertise Your Telegram</h3>
                    <p>Browse the best telegram channels &amp; groups</p>
                    <p>
                        Telegram is not affiliated or endorsed with / by
                        Telegram
                    </p>
                </div>
            </footer>
        </div>
    )
}

function Detail({
    label,
    value,
}: {
    label: string
    value: string
}) {
    return (
        <div className="detailStat">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function Faq({
    question,
    answer,
}: {
    question: string
    answer: string
}) {
    return (
        <article className="faqItem">
            <h3>{question}</h3>
            <p>{answer}</p>
        </article>
    )
}
