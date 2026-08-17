"use client"

import { createClient } from "@supabase/supabase-js"
import * as React from "react"

const BACKEND_URL = "https://telegramboard.onrender.com"
const LOGO_URL =
    "https://framerusercontent.com/images/uGdsn8V7FG4qrMfIKZjL5lxDo.png"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function formatCompactNumber(value: number) {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000)
            .toFixed(1)
            .replace(/\.0$/, "")}b`
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`
    }
    return String(value)
}

type IconProps = {
    size?: number
    color?: string
    fill?: string
}

function UserIcon({ size = 16, color = "currentColor" }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    )
}

function PlusIcon({ size = 16, color = "currentColor" }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
        </svg>
    )
}

function LogOutIcon({ size = 16, color = "currentColor" }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    )
}

function MenuIcon({ size = 20, color = "currentColor" }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
    )
}

function XIcon({ size = 20, color = "currentColor" }: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}

function SendIcon({
    size = 18,
    color = "currentColor",
    fill = "none",
}: IconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={fill}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </svg>
    )
}

export default function SiteHeader() {
    const brandName = "Telehub"
    const homePath = "/"
    const loginPath = "/login"
    const dashboardPath = "/dashboard"
    const addChannelPath = "/add-channel"
    const profilePath = "/profile"
    const loggedOutSecondaryText = "Log in"
    const showDashboard = true
    const showBrand = true
    const sticky = true

    const [loading, setLoading] = React.useState(true)
    const [user, setUser] = React.useState<any>(null)
    const [profileUsername, setProfileUsername] = React.useState("")
    const [onlineCount, setOnlineCount] = React.useState(0)
    const [logoFailed, setLogoFailed] = React.useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

    React.useEffect(() => {
        let mounted = true

        async function loadProfileUsername(session: any) {
            if (!session?.access_token) {
                if (mounted) setProfileUsername("")
                return
            }

            try {
                const response = await fetch(`${BACKEND_URL}/api/profile`, {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data?.error || "Could not load profile.")
                }

                if (mounted) {
                    setProfileUsername(data?.profile?.username || "")
                }
            } catch (error) {
                console.error("Navbar profile load error:", error)
                if (mounted) setProfileUsername("")
            }
        }

        async function loadSession() {
            const { data, error } = await supabase.auth.getSession()
            if (error) console.error(error.message)

            if (mounted) {
                setUser(data.session?.user ?? null)
                await loadProfileUsername(data.session)
                setLoading(false)
            }
        }

        loadSession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null)
            await loadProfileUsername(session)
            setLoading(false)
        })

        async function handleUsernameUpdated(event: Event) {
            const customEvent = event as CustomEvent<{ username?: string }>
            const nextUsername = customEvent.detail?.username

            if (typeof nextUsername === "string") {
                setProfileUsername(nextUsername)
                return
            }

            const { data } = await supabase.auth.getSession()
            await loadProfileUsername(data.session)
        }

        window.addEventListener(
            "telehub:username-updated",
            handleUsernameUpdated as EventListener
        )

        return () => {
            mounted = false
            subscription.unsubscribe()
            window.removeEventListener(
                "telehub:username-updated",
                handleUsernameUpdated as EventListener
            )
        }
    }, [])

    React.useEffect(() => {
        setLogoFailed(false)
    }, [])

    React.useEffect(() => {
        const closeDesktopMenu = () => {
            if (window.innerWidth > 820) setMobileMenuOpen(false)
        }

        closeDesktopMenu()
        window.addEventListener("resize", closeDesktopMenu)

        return () => window.removeEventListener("resize", closeDesktopMenu)
    }, [])

    React.useEffect(() => {
        async function fetchOnlineCount() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/stats/online`)
                const data = await res.json()

                if (typeof data.online === "number") {
                    setOnlineCount(data.online)
                }
            } catch (err) {
                console.log(err)
            }
        }

        fetchOnlineCount()

        const interval = setInterval(fetchOnlineCount, 30000)

        return () => clearInterval(interval)
    }, [])

    async function handleSignOut() {
        const { error } = await supabase.auth.signOut()

        if (error) {
            console.error(error.message)
            return
        }

        window.location.href = homePath || "/"
    }

    const displayName =
        profileUsername ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email?.split("@")[0] ||
        "Account"

    return (
        <div style={shellStyle(sticky)}>
            <style>{`
    .telecadia-mobile-menu-button {
        display: none !important;
    }

    .telecadia-mobile-panel {
        display: none !important;
    }

    @media (max-width: 820px) {
        .telecadia-auth-inner {
            align-items: center !important;
            padding: 12px 14px !important;
            flex-wrap: nowrap !important;
            gap: 10px !important;
        }

        .telecadia-brand-text {
            font-size: 18px !important;
        }

        .telecadia-auth-right {
            display: none !important;
        }

        .telecadia-mobile-menu-button {
            display: inline-flex !important;
            margin-left: auto !important;
        }

        .telecadia-mobile-panel {
            display: grid !important;
        }

        .telecadia-online-chip {
            display: none !important;
        }
    }
`}</style>

            <div className="telecadia-auth-inner" style={innerStyle}>
                <div style={leftStyle}>
                    {showBrand ? (
                        <>
                            <a href={homePath || "/"} style={brandStyle}>
                                {LOGO_URL && !logoFailed ? (
                                    <img
                                        src={LOGO_URL}
                                        alt={brandName || "Telehub"}
                                        onError={() => setLogoFailed(true)}
                                        style={{
                                            width: 42,
                                            height: 42,
                                            maxHeight: 42,
                                            borderRadius: 999,
                                            objectFit: "contain",
                                            display: "block",
                                            flexShrink: 0,
                                        }}
                                    />
                                ) : (
                                    <div style={iconBubbleStyle}>
                                        <SendIcon size={18} fill="white" />
                                    </div>
                                )}

                                <span className="telecadia-brand-text">
                                    {brandName || "Telehub"}
                                </span>
                            </a>

                            <div
                                className="telecadia-online-chip"
                                style={onlineChip}
                            >
                                <span style={onlineDot} />
                                <span>
                                    Online: {formatCompactNumber(onlineCount)}
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={onlineChip}>
                            <span style={onlineDot} />
                            <span>
                                Online: {formatCompactNumber(onlineCount)}
                            </span>
                        </div>
                    )}
                </div>

                <div className="telecadia-auth-right" style={rightStyle}>
                    {loading ? (
                        <div style={mutedStyle}>Loading...</div>
                    ) : user ? (
                        <>
                            <a
                                href={profilePath || "/profile"}
                                style={userChip}
                                aria-label="Open profile"
                            >
                                <UserIcon size={16} color="#2C74F4" />
                                <span>{displayName}</span>
                            </a>

                            <a
                                href={addChannelPath || "/add-channel"}
                                style={primaryButton}
                            >
                                <PlusIcon size={16} />
                                <span>Add Your Channel</span>
                            </a>

                            {showDashboard ? (
                                <a
                                    href={dashboardPath || "/dashboard"}
                                    style={buttonBase}
                                >
                                    Dashboard
                                </a>
                            ) : null}

                            <button
                                onClick={handleSignOut}
                                style={buttonBase}
                            >
                                <LogOutIcon size={16} />
                                <span>Sign out</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <a
                                href={loginPath || "/login"}
                                style={buttonBase}
                            >
                                {loggedOutSecondaryText || "Log in"}
                            </a>

                            <a
                                href={addChannelPath || "/add-channel"}
                                style={primaryButton}
                            >
                                <PlusIcon size={16} />
                                <span>Add Your Channel</span>
                            </a>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    className="telecadia-mobile-menu-button"
                    aria-label={
                        mobileMenuOpen ? "Close menu" : "Open menu"
                    }
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    style={mobileMenuButton}
                >
                    {mobileMenuOpen ? (
                        <XIcon size={20} />
                    ) : (
                        <MenuIcon size={20} />
                    )}
                    <span>Menu</span>
                </button>
            </div>

            {!loading && mobileMenuOpen ? (
                <div
                    className="telecadia-mobile-panel"
                    style={mobilePanel}
                >
                    {user ? (
                        <>
                            <a
                                href={profilePath || "/profile"}
                                style={mobileUserRow}
                                aria-label="Open profile"
                            >
                                <UserIcon size={16} color="#2C74F4" />
                                <span>{displayName}</span>
                            </a>

                            <a
                                href={addChannelPath || "/add-channel"}
                                style={mobilePrimaryButton}
                            >
                                <PlusIcon size={16} />
                                <span>Add Your Channel</span>
                            </a>

                            {showDashboard ? (
                                <a
                                    href={dashboardPath || "/dashboard"}
                                    style={mobileButtonBase}
                                >
                                    Dashboard
                                </a>
                            ) : null}

                            <button
                                onClick={handleSignOut}
                                style={mobileButtonBase}
                            >
                                <LogOutIcon size={16} />
                                <span>Sign out</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <a
                                href={loginPath || "/login"}
                                style={mobileButtonBase}
                            >
                                {loggedOutSecondaryText || "Log in"}
                            </a>

                            <a
                                href={addChannelPath || "/add-channel"}
                                style={mobilePrimaryButton}
                            >
                                <PlusIcon size={16} />
                                <span>Add Your Channel</span>
                            </a>
                        </>
                    )}
                </div>
            ) : null}
        </div>
    )
}

const shellStyle = (sticky: boolean): React.CSSProperties => ({
    width: "100%",
    boxSizing: "border-box",
    position: sticky ? "sticky" : "relative",
    top: sticky ? 0 : undefined,
    zIndex: 50,
    background: "rgba(241, 246, 255, 0.74)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(210, 224, 245, 0.9)",
})

const innerStyle: React.CSSProperties = {
    maxWidth: 1440,
    margin: "0 auto",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const leftStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
}

const rightStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    marginLeft: "auto",
}

const brandStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 12,
    textDecoration: "none",
    color: "#102A5E",
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: "-0.03em",
}

const iconBubbleStyle: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #43A4FF, #2C74F4)",
    boxShadow: "0 10px 26px rgba(44, 116, 244, 0.22)",
    color: "white",
    flexShrink: 0,
}

const onlineChip: React.CSSProperties = {
    height: 36,
    padding: "0 13px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    background: "rgba(255,255,255,0.76)",
    border: "1px solid rgba(210, 224, 245, 0.95)",
    color: "#102A5E",
    fontSize: 14,
    fontWeight: 800,
    boxShadow: "0 10px 28px rgba(69, 118, 208, 0.06)",
    whiteSpace: "nowrap",
}

const onlineDot: React.CSSProperties = {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#16B85F",
    boxShadow: "0 0 0 4px rgba(22,184,95,0.14)",
    flexShrink: 0,
}

const buttonBase: React.CSSProperties = {
    height: 46,
    padding: "0 18px",
    borderRadius: 16,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid rgba(210, 224, 245, 0.95)",
    background: "rgba(255,255,255,0.82)",
    color: "#26477D",
    fontSize: 15,
    fontWeight: 600,
    textDecoration: "none",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    boxShadow: "0 10px 28px rgba(69, 118, 208, 0.06)",
    cursor: "pointer",
}

const primaryButton: React.CSSProperties = {
    ...buttonBase,
    background: "linear-gradient(135deg, #43A4FF, #2C74F4)",
    color: "white",
    border: "1px solid #2C74F4",
    boxShadow: "0 16px 36px rgba(44, 116, 244, 0.22)",
}

const mutedStyle: React.CSSProperties = {
    color: "#7C8FB8",
    fontSize: 14,
    fontWeight: 500,
}

const userChip: React.CSSProperties = {
    ...buttonBase,
    padding: "0 14px",
    gap: 10,
    textDecoration: "none",
}

const mobileMenuButton: React.CSSProperties = {
    height: 42,
    padding: "0 13px",
    borderRadius: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid rgba(210, 224, 245, 0.95)",
    background: "rgba(255,255,255,0.88)",
    color: "#26477D",
    fontSize: 14,
    fontWeight: 800,
    boxShadow: "0 10px 28px rgba(69, 118, 208, 0.08)",
    cursor: "pointer",
    whiteSpace: "nowrap",
}

const mobilePanel: React.CSSProperties = {
    width: "calc(100% - 28px)",
    margin: "0 14px 12px",
    padding: 12,
    boxSizing: "border-box",
    gridTemplateColumns: "1fr",
    gap: 10,
    borderRadius: 20,
    border: "1px solid rgba(210, 224, 245, 0.95)",
    background: "rgba(255,255,255,0.82)",
    boxShadow: "0 18px 44px rgba(69, 118, 208, 0.12)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const mobileButtonBase: React.CSSProperties = {
    width: "100%",
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 15,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid rgba(210, 224, 245, 0.95)",
    background: "rgba(255,255,255,0.92)",
    color: "#26477D",
    fontSize: 15,
    fontWeight: 800,
    textDecoration: "none",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
    cursor: "pointer",
}

const mobilePrimaryButton: React.CSSProperties = {
    ...mobileButtonBase,
    background: "linear-gradient(135deg, #43A4FF, #2C74F4)",
    color: "white",
    border: "1px solid #2C74F4",
    boxShadow: "0 14px 30px rgba(44, 116, 244, 0.22)",
}

const mobileUserRow: React.CSSProperties = {
    ...mobileButtonBase,
    justifyContent: "flex-start",
    background: "rgba(248,251,255,0.94)",
    color: "#102A5E",
}
