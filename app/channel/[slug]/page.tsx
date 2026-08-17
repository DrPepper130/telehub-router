import type { Metadata } from "next"
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
    getSeoDescription,
    getSeoTitle,
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

    const title = getSeoTitle(listing)
    const description = getSeoDescription(listing)
    const canonicalSlug = listing.short_invite || slug
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
    const joinUrl =
        listing.telegram_link ||
        (username
            ? `https://t.me/${username.replace(/^@/, "")}`
            : "#")

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
