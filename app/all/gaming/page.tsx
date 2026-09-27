import type { Metadata } from "next"
import styles from "./GamingCategory.module.css"

export const runtime = "nodejs"
export const revalidate = 300

const SITE_ORIGIN = "https://telehub.to"
const BACKEND_URL = "https://telegramboard.onrender.com"
const CANONICAL_URL = `${SITE_ORIGIN}/all/gaming`

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type DirectoryListing = {
    id?: string
    short_invite?: string | null
    channel_name?: string | null
    telegram_title?: string | null
    telegram_username?: string | null
    telegram_link?: string | null
    description?: string | null
    telegram_description?: string | null
    long_description?: string | null
    categories?: string[] | string | null
    member_count?: number | null
    votes_count?: number | null
    icon_url?: string | null
    image_url?: string | null
    listing_type?: string | null
    paid_rank?: string | null
    paid_rank_status?: string | null
    member_growth_24h?: number | null
    language_code?: string | null
    language_name?: string | null
}

type DirectoryPayload = {
    ok?: boolean
    listings?: DirectoryListing[]
    total_count?: number
    total_pages?: number
    page?: number
    has_next_page?: boolean
    has_previous_page?: boolean
}

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || "" : value || ""
}

function normalizeType(value: string) {
    const clean = value.toLowerCase()
    return clean === "channel" || clean === "group" ? clean : "all"
}

function normalizeSort(value: string) {
    return ["Top", "Active", "Members"].includes(value) ? value : "Top"
}

function normalizePage(value: string) {
    const page = Number.parseInt(value, 10)
    return Number.isInteger(page) && page > 0 ? page : 1
}

function cleanText(value: unknown, max = 180) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
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

function listingName(item: DirectoryListing) {
    return (
        cleanText(item.channel_name, 100) ||
        cleanText(item.telegram_title, 100) ||
        cleanText(item.telegram_username, 100) ||
        "Telegram community"
    )
}

function listingDescription(item: DirectoryListing) {
    return (
        cleanText(item.description, 240) ||
        cleanText(item.telegram_description, 240) ||
        cleanText(item.long_description, 240) ||
        "Explore this gaming community on Telegram."
    )
}

function categoryArray(value: DirectoryListing["categories"]) {
    if (Array.isArray(value)) {
        return value.map((x) => cleanText(x, 40)).filter(Boolean)
    }
    return String(value || "")
        .split(",")
        .map((x) => cleanText(x, 40))
        .filter(Boolean)
}

async function getGamingDirectory(args: {
    type: "all" | "channel" | "group"
    sort?: string
    page?: number
    q?: string
    nsfw?: boolean
    pageSize?: number
}): Promise<DirectoryPayload> {
    const params = new URLSearchParams()
    params.set("type", args.type)
    params.set("category", "Gaming")
    params.set("sort", normalizeSort(args.sort || "Top"))
    params.set("page", String(args.page || 1))
    params.set("page_size", String(args.pageSize || 18))

    if (args.q) params.set("q", args.q.slice(0, 120))
    if (args.nsfw) params.set("nsfw", "1")

    try {
        const response = await fetch(`${BACKEND_URL}/api/directory?${params}`, {
            headers: {
                Accept: "application/json",
                "User-Agent": "TeleHubGamingCategory/1.0 (+https://telehub.to)",
            },
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(2500),
        })

        if (!response.ok) return {}

        const payload = (await response.json()) as DirectoryPayload
        return payload && typeof payload === "object" ? payload : {}
    } catch {
        return {}
    }
}

function buildPageUrl(params: {
    type?: string
    sort?: string
    page?: number
    q?: string
    nsfw?: boolean
}) {
    const search = new URLSearchParams()

    if (params.type && params.type !== "all") search.set("type", params.type)
    if (params.sort && params.sort !== "Top") search.set("sort", params.sort)
    if (params.page && params.page > 1) search.set("page", String(params.page))
    if (params.q) search.set("q", params.q)
    if (params.nsfw) search.set("nsfw", "1")

    const query = search.toString()
    return `/all/gaming${query ? `?${query}` : ""}`
}

function typeLabel(type: "all" | "channel" | "group") {
    if (type === "channel") return "channels"
    if (type === "group") return "groups"
    return "communities"
}

export async function generateMetadata({
    searchParams,
}: {
    searchParams: SearchParams
}): Promise<Metadata> {
    const params = await searchParams
    const hasVariant =
        Boolean(firstParam(params.q)) ||
        Boolean(firstParam(params.type)) ||
        Boolean(firstParam(params.sort)) ||
        Boolean(firstParam(params.nsfw)) ||
        normalizePage(firstParam(params.page)) > 1

    const title = "Best Gaming Telegram Channels & Groups | TeleHub"
    const description =
        "Browse active gaming Telegram channels and groups on TeleHub. Compare community size, categories, activity and discover gaming communities worth joining."

    return {
        title,
        description,
        alternates: {
            canonical: CANONICAL_URL,
        },
        robots: hasVariant
            ? {
                  index: false,
                  follow: true,
              }
            : {
                  index: true,
                  follow: true,
              },
        openGraph: {
            type: "website",
            url: CANONICAL_URL,
            siteName: "TeleHub",
            title,
            description,
        },
        twitter: {
            card: "summary",
            title,
            description,
        },
    }
}

export default async function GamingCategoryPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const params = await searchParams
    const type = normalizeType(firstParam(params.type))
    const sort = normalizeSort(firstParam(params.sort) || "Top")
    const page = normalizePage(firstParam(params.page))
    const q = cleanText(firstParam(params.q), 120)
    const nsfw = firstParam(params.nsfw) === "1"

    const [directory, channelCountResult, groupCountResult] = await Promise.all([
        getGamingDirectory({
            type,
            sort,
            page,
            q,
            nsfw,
            pageSize: 18,
        }),
        getGamingDirectory({
            type: "channel",
            pageSize: 1,
        }),
        getGamingDirectory({
            type: "group",
            pageSize: 1,
        }),
    ])

    const listings = Array.isArray(directory.listings)
        ? directory.listings
        : []

    const totalCount = Number(directory.total_count || 0)
    const totalPages = Math.max(1, Number(directory.total_pages || 1))
    const channelCount = Number(channelCountResult.total_count || 0)
    const groupCount = Number(groupCountResult.total_count || 0)
    const communityCount =
        channelCount + groupCount > 0
            ? channelCount + groupCount
            : type === "all"
              ? totalCount
              : 0

    const itemListElements = listings
        .filter((item) => item.short_invite)
        .map((item, index) => ({
            "@type": "ListItem",
            position: (page - 1) * 18 + index + 1,
            name: listingName(item),
            url: `${SITE_ORIGIN}/channel/${encodeURIComponent(
                String(item.short_invite)
            )}`,
        }))

    const structuredData = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                {
                    "@type": "ListItem",
                    position: 1,
                    name: "TeleHub",
                    item: `${SITE_ORIGIN}/`,
                },
                {
                    "@type": "ListItem",
                    position: 2,
                    name: "Telegram Communities",
                    item: `${SITE_ORIGIN}/all`,
                },
                {
                    "@type": "ListItem",
                    position: 3,
                    name: "Gaming",
                    item: CANONICAL_URL,
                },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Gaming Telegram Channels & Groups",
            description:
                "A directory of gaming Telegram channels and groups, ranked using TeleHub community and activity signals.",
            url: CANONICAL_URL,
            isPartOf: {
                "@type": "WebSite",
                name: "TeleHub",
                url: SITE_ORIGIN,
            },
            mainEntity: {
                "@type": "ItemList",
                name: "Gaming Telegram communities",
                numberOfItems: totalCount,
                itemListElement: itemListElements,
            },
        },
    ]

    return (
        <div className={styles.page}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData),
                }}
            />

            <div className={styles.promoBar}>
                <a href="/widgets">
                    Are You a Website Owner? Use Our Free Website Embeds
                </a>
            </div>

            <header className={styles.header}>
                <a className={styles.brand} href="/">
                    <span className={styles.brandMark}>✈</span>
                    <span>TeleHub</span>
                </a>

                <nav className={styles.headerNav}>
                    <a href="/all">All Communities</a>
                    <a href="/channels">Channels</a>
                    <a href="/groups">Groups</a>
                    <a className={styles.addButton} href="/add-channel">
                        + Add Your Channel
                    </a>
                </nav>
            </header>

            <main className={styles.main}>
                <section className={styles.hero}>
                    <div className={styles.breadcrumbs}>
                        <a href="/">TeleHub</a>
                        <span>›</span>
                        <a href="/all">Communities</a>
                        <span>›</span>
                        <strong>Gaming</strong>
                    </div>

                    <div className={styles.heroTop}>
                        <div>
                            <span className={styles.eyebrow}>
                                Gaming Telegram Directory
                            </span>
                            <h1>Best Gaming Telegram Channels &amp; Groups</h1>
                            <p>
                                Discover gaming Telegram communities for players,
                                creators, esports fans, game-specific discussion,
                                news, trading, LFG and general gaming chat. Browse
                                channels and groups ranked with TeleHub directory
                                signals.
                            </p>
                        </div>

                        <a className={styles.addHeroButton} href="/add-channel">
                            Add a Gaming Community
                        </a>
                    </div>

                    <div className={styles.stats}>
                        <div>
                            <strong>{communityCount.toLocaleString()}</strong>
                            <span>Gaming communities</span>
                        </div>
                        <div>
                            <strong>{channelCount.toLocaleString()}</strong>
                            <span>Gaming channels</span>
                        </div>
                        <div>
                            <strong>{groupCount.toLocaleString()}</strong>
                            <span>Gaming groups</span>
                        </div>
                    </div>

                    <div className={styles.related}>
                        <span>Related:</span>
                        <a className={styles.activeChip} href="/all/gaming">
                            Gaming
                        </a>
                        <a href="/all?category=Technology">Technology</a>
                        <a href="/all?category=Anime">Anime</a>
                        <a href="/all?category=Crypto">Crypto</a>
                        <a href="/all?category=Entertainment">Entertainment</a>
                    </div>
                </section>

                <section className={styles.directory}>
                    <div className={styles.directoryHeader}>
                        <div>
                            <div className={styles.resultBadge}>
                                {totalCount.toLocaleString()} Gaming{" "}
                                {typeLabel(type)} found
                            </div>
                            <h2>
                                {q
                                    ? `${q} in Gaming Telegram ${typeLabel(type)}`
                                    : `Gaming Telegram ${typeLabel(type)}`}
                            </h2>
                        </div>
                    </div>

                    <div className={styles.controls}>
                        <div className={styles.segmented}>
                            {[
                                ["all", "All"],
                                ["channel", "Channels"],
                                ["group", "Groups"],
                            ].map(([value, label]) => (
                                <a
                                    key={value}
                                    className={
                                        type === value ? styles.selected : ""
                                    }
                                    href={buildPageUrl({
                                        type: value,
                                        sort,
                                        q,
                                        nsfw,
                                    })}
                                >
                                    {label}
                                </a>
                            ))}
                        </div>

                        <div className={styles.segmented}>
                            {["Top", "Active", "Members"].map((mode) => (
                                <a
                                    key={mode}
                                    className={
                                        sort === mode ? styles.selected : ""
                                    }
                                    href={buildPageUrl({
                                        type,
                                        sort: mode,
                                        q,
                                        nsfw,
                                    })}
                                >
                                    {mode}
                                </a>
                            ))}
                        </div>

                        <a
                            className={`${styles.nsfwToggle} ${
                                nsfw ? styles.nsfwOn : ""
                            }`}
                            href={buildPageUrl({
                                type,
                                sort,
                                q,
                                nsfw: !nsfw,
                            })}
                        >
                            🔞 {nsfw ? "NSFW on" : "NSFW"}
                        </a>
                    </div>

                    <form className={styles.search} method="get">
                        {type !== "all" ? (
                            <input type="hidden" name="type" value={type} />
                        ) : null}
                        {sort !== "Top" ? (
                            <input type="hidden" name="sort" value={sort} />
                        ) : null}
                        {nsfw ? (
                            <input type="hidden" name="nsfw" value="1" />
                        ) : null}
                        <input
                            type="search"
                            name="q"
                            defaultValue={q}
                            placeholder="Search Gaming Telegram communities"
                            aria-label="Search Gaming Telegram communities"
                        />
                        <button type="submit">Search</button>
                    </form>

                    {listings.length ? (
                        <div className={styles.grid}>
                            {page === 1 ? (
                                <a
                                    className={`${styles.card} ${styles.sponsorCard}`}
                                    href="/sponsor"
                                >
                                    <span className={styles.sponsorEyebrow}>
                                        ✦ Top placement
                                    </span>
                                    <h3>Become a TeleHub sponsor</h3>
                                    <p>
                                        Put your Telegram community in front of
                                        people browsing Gaming.
                                    </p>
                                    <span className={styles.sponsorButton}>
                                        Sponsor your community ›
                                    </span>
                                </a>
                            ) : null}

                            {listings.map((item) => {
                                const name = listingName(item)
                                const categories = categoryArray(item.categories)
                                const slug = String(item.short_invite || "").trim()
                                const rank = String(
                                    item.paid_rank || "free"
                                ).toLowerCase()
                                const rankActive =
                                    String(
                                        item.paid_rank_status || ""
                                    ).toLowerCase() === "active"

                                return (
                                    <article
                                        className={styles.card}
                                        key={String(item.id || slug)}
                                    >
                                        <div className={styles.cardHeader}>
                                            {item.icon_url ? (
                                                <img
                                                    className={styles.avatar}
                                                    src={item.icon_url}
                                                    alt=""
                                                    width={52}
                                                    height={52}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div
                                                    className={
                                                        styles.avatarFallback
                                                    }
                                                >
                                                    🎮
                                                </div>
                                            )}

                                            <div className={styles.cardIdentity}>
                                                <h3>{name}</h3>
                                                <span>
                                                    {item.telegram_username
                                                        ? `@${String(
                                                              item.telegram_username
                                                          ).replace(/^@/, "")}`
                                                        : "Telegram community"}
                                                </span>
                                            </div>

                                            {rankActive && rank !== "free" ? (
                                                <span className={styles.rankBadge}>
                                                    {rank}
                                                </span>
                                            ) : null}
                                        </div>

                                        <div className={styles.tagRow}>
                                            <span className={styles.typeBadge}>
                                                {String(
                                                    item.listing_type || "channel"
                                                ).toLowerCase() === "group"
                                                    ? "Group"
                                                    : "Channel"}
                                            </span>
                                            {categories
                                                .slice(0, 3)
                                                .map((category) => (
                                                    <span key={category}>
                                                        {category}
                                                    </span>
                                                ))}
                                        </div>

                                        <p className={styles.cardDescription}>
                                            {listingDescription(item)}
                                        </p>

                                        <div className={styles.cardStats}>
                                            <span>
                                                <strong>
                                                    {compactNumber(
                                                        item.member_count
                                                    )}
                                                </strong>
                                                members
                                            </span>
                                            <span>
                                                <strong>
                                                    {Number(
                                                        item.votes_count || 0
                                                    ).toLocaleString()}
                                                </strong>
                                                votes
                                            </span>
                                        </div>

                                        <div className={styles.cardActions}>
                                            {slug ? (
                                                <a
                                                    className={
                                                        styles.secondaryButton
                                                    }
                                                    href={`/channel/${encodeURIComponent(
                                                        slug
                                                    )}`}
                                                >
                                                    View
                                                </a>
                                            ) : null}
                                            {item.telegram_link ? (
                                                <a
                                                    className={
                                                        styles.primaryButton
                                                    }
                                                    href={item.telegram_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    Join ↗
                                                </a>
                                            ) : null}
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    ) : (
                        <div className={styles.empty}>
                            <h3>No matching Gaming communities found</h3>
                            <p>
                                Try another search or switch between channels and
                                groups.
                            </p>
                            <a href="/add-channel">Add a Gaming community ›</a>
                        </div>
                    )}

                    {totalPages > 1 ? (
                        <nav
                            className={styles.pagination}
                            aria-label="Gaming directory pagination"
                        >
                            {page > 1 ? (
                                <a
                                    href={buildPageUrl({
                                        type,
                                        sort,
                                        page: page - 1,
                                        q,
                                        nsfw,
                                    })}
                                >
                                    ← Previous
                                </a>
                            ) : (
                                <span />
                            )}

                            <strong>
                                Page {page.toLocaleString()} of{" "}
                                {totalPages.toLocaleString()}
                            </strong>

                            {page < totalPages ? (
                                <a
                                    href={buildPageUrl({
                                        type,
                                        sort,
                                        page: page + 1,
                                        q,
                                        nsfw,
                                    })}
                                >
                                    Next →
                                </a>
                            ) : (
                                <span />
                            )}
                        </nav>
                    ) : null}
                </section>

                <section className={styles.contentSection}>
                    <div>
                        <span className={styles.eyebrow}>
                            About Gaming on Telegram
                        </span>
                        <h2>Find Gaming Telegram communities by interest</h2>
                        <p>
                            Gaming communities on Telegram range from broad gaming
                            discussion groups to channels focused on individual
                            games, esports, updates, clips, trading, mods and
                            finding people to play with. TeleHub brings those
                            communities into one searchable directory so you can
                            compare options before opening Telegram.
                        </p>
                    </div>

                    <div className={styles.faq}>
                        <article>
                            <h3>
                                What are the best Gaming Telegram channels and
                                groups?
                            </h3>
                            <p>
                                The directory above ranks Gaming communities using
                                TeleHub directory signals. You can switch between
                                Top, Active and Members depending on what matters
                                most to you.
                            </p>
                        </article>
                        <article>
                            <h3>
                                Can I browse only Gaming Telegram groups?
                            </h3>
                            <p>
                                Yes. Select Groups above to show Gaming groups, or
                                Channels to show broadcast-style Gaming channels.
                            </p>
                        </article>
                        <article>
                            <h3>
                                How do I add a Gaming Telegram community?
                            </h3>
                            <p>
                                Add your Telegram channel or group through TeleHub
                                and select Gaming when it fits the community.
                                Approved listings can then appear in the Gaming
                                directory.
                            </p>
                        </article>
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                <div>
                    <strong>TeleHub</strong>
                    <span>Discover Telegram channels and groups.</span>
                </div>
                <nav>
                    <a href="/channels">Channels</a>
                    <a href="/groups">Groups</a>
                    <a href="/blog">Blog</a>
                    <a href="/about">About</a>
                </nav>
            </footer>
        </div>
    )
}
