import type { Metadata } from "next"
import { notFound } from "next/navigation"

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

function number(value: number | null | undefined) {
    return Number(value || 0).toLocaleString()
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
    const canonical =
        `https://telehub.to/channel/${canonicalSlug}`

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
    }
}

export default async function ChannelPage({
    params,
}: PageProps) {
    const { slug } = await params
    const listing = await getListingBySlug(slug)

    if (!listing) {
        notFound()
    }

    const name = getListingName(listing)
    const listingType = getListingType(listing)
    const categories = getCategories(listing)
    const shortDescription = getShortDescription(listing)
    const longDescription = getLongDescription(listing)
    const username = getTelegramUsername(listing)

    const members = Number(listing.member_count || 0)
    const votes = Number(listing.votes_count || 0)

    const rank = String(listing.paid_rank || "free").toLowerCase()
    const status = String(listing.status || "approved").toLowerCase()

    const joinUrl =
        listing.telegram_link ||
        (username
            ? `https://t.me/${username.replace(/^@/, "")}`
            : "#")

    const backgroundStyle = listing.image_url
        ? {
              backgroundImage: `
                linear-gradient(
                    rgba(221, 239, 255, 0.78),
                    rgba(221, 239, 255, 0.78)
                ),
                url("${listing.image_url}")
              `,
          }
        : undefined

    return (
        <div
            className="page"
            style={backgroundStyle}
        >
            <div className="topBanner">
                Are You a Website Owner? Use Our Free Website Embeds
            </div>

            <header className="header">
                <a
                    href="https://telehub.to"
                    className="brand"
                >
                    <div className="brandIcon">T</div>

                    <strong>Telehub</strong>

                    <span className="online">
                        ● Online
                    </span>
                </a>

                <div className="headerActions">
                    <a
                        href="https://telehub.to/login"
                        className="loginButton"
                    >
                        Log in
                    </a>

                    <a
                        href="https://telehub.to/add-channel"
                        className="addButton"
                    >
                        + Add Your Channel
                    </a>
                </div>
            </header>

            <main className="container">
                <a
                    href="https://telehub.to/all"
                    className="back"
                >
                    ‹ Back to listings
                </a>

                <section className="hero card">
                    <div className="listingTop">
                        <div className="avatarWrap">
                            {listing.icon_url ? (
                                <img
                                    src={listing.icon_url}
                                    alt={`${name} Telegram icon`}
                                    className="avatar"
                                />
                            ) : (
                                <div className="avatar placeholder">
                                    T
                                </div>
                            )}
                        </div>

                        <div className="identity">
                            <div className="badges">
                                <span className="typeBadge">
                                    {listingType.toUpperCase()}
                                </span>

                                {categories
                                    .slice(0, 3)
                                    .map((category) => (
                                        <span
                                            className="categoryBadge"
                                            key={category}
                                        >
                                            {category}
                                        </span>
                                    ))}
                            </div>

                            <h1>{name}</h1>

                            <p className="shortDescription">
                                {shortDescription}
                            </p>
                        </div>
                    </div>

                    <div className="statsRow">
                        <div className="usernameStat">
                            <span>TELEGRAM USERNAME</span>
                            <strong>
                                {username || "—"}
                            </strong>
                        </div>

                        <div className="stat green">
                            <span>MEMBERS</span>
                            <strong>
                                {number(members)}
                            </strong>
                        </div>

                        <div className="stat blue">
                            <span>VOTES</span>
                            <strong>
                                {number(votes)}
                            </strong>
                        </div>

                        <a
                            className="saveButton"
                            href="https://telehub.to/login"
                        >
                            ☆ Save
                        </a>

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

                <section className="twoColumn">
                    <article className="card infoCard">
                        <h2>About this listing</h2>

                        <p>
                            {name} is a Telegram {listingType} listed
                            on TeleHub. View its description,
                            category, member count, and Telegram
                            join link.
                        </p>
                    </article>

                    <article className="card infoCard">
                        <h2>Description</h2>

                        <p>{longDescription}</p>
                    </article>
                </section>

                <section className="card detailSection">
                    <h2>Listing details</h2>

                    <div className="detailGrid">
                        <Detail
                            label="MEMBERS"
                            value={number(members)}
                        />

                        <Detail
                            label="VOTES"
                            value={number(votes)}
                        />

                        <Detail
                            label="RANK"
                            value={rank}
                        />

                        <Detail
                            label="STATUS"
                            value={status}
                        />
                    </div>

                    <div className="detailLabels">
                        <span>Listing Stats</span>
                        <span>Listing ID</span>
                    </div>

                    <div className="listingId">
                        {listing.id}
                    </div>
                </section>

                <section className="card safety">
                    <h2>Safety and reporting</h2>

                    <p>
                        TeleHub helps users discover Telegram
                        communities, but users should review each
                        community before joining. Report misleading,
                        unsafe, or inappropriate listings here.
                    </p>

                    <a
                        href="https://telehub.to/report"
                        className="reportButton"
                    >
                        Report a listing
                    </a>
                </section>

                <section className="faq">
                    <h2>FAQ</h2>

                    <Faq
                        question={`What is ${name}?`}
                        answer={`${name} is a Telegram ${listingType} listed in the TeleHub directory with static details prepared for search engines and visitors.`}
                    />

                    <Faq
                        question={`How do I join this Telegram ${listingType}?`}
                        answer="Use the Join Telegram button on this page to open the Telegram URL imported from the listing source."
                    />

                    <Faq
                        question="Is this listing verified by TeleHub?"
                        answer="TeleHub provides directory information and safety reporting tools. Review each community before joining and report misleading or unsafe listings."
                    />
                </section>

                <div className="bottomLinks">
                    <a href="https://telehub.to">
                        Back to TeleHub
                    </a>

                    <a href="https://telehub.to/all">
                        Browse directory
                    </a>
                </div>
            </main>

            <footer className="footer">
                <div>
                    <h3>Community</h3>
                    <a href="https://telehub.to/channels">
                        Telegram Channels
                    </a>
                    <a href="https://telehub.to/groups">
                        Telegram Groups
                    </a>
                    <a href="https://telehub.to/blog">
                        Blog
                    </a>
                </div>

                <div>
                    <h3>Safety</h3>
                    <a href="https://telehub.to/guidelines">
                        Guidelines
                    </a>
                    <a href="https://telehub.to/moderation">
                        Moderation Policy
                    </a>
                    <a href="https://telehub.to/report">
                        Report a Listing
                    </a>
                </div>

                <div>
                    <h3>Company</h3>
                    <a href="https://telehub.to/about">
                        About
                    </a>
                </div>

                <div>
                    <h3>Legal</h3>
                    <a href="https://telehub.to/privacy">
                        Privacy
                    </a>
                    <a href="https://telehub.to/terms">
                        Terms
                    </a>
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
        <div className="detail">
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
