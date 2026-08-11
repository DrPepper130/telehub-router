"use client"

import { createClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"

const BACKEND_URL = "https://telegramboard.onrender.com"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SiteHeader() {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [onlineCount, setOnlineCount] = useState<number>(20000)
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        let mounted = true

        async function loadSession() {
            const { data } = await supabase.auth.getSession()

            if (mounted) {
                setUser(data.session?.user ?? null)
                setLoading(false)
            }
        }

        loadSession()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    useEffect(() => {
        let mounted = true

        async function fetchOnlineCount() {
            try {
                const response = await fetch(
                    `${BACKEND_URL}/api/stats/online`
                )
                const data = await response.json()

                if (
                    mounted &&
                    typeof data?.online === "number"
                ) {
                    setOnlineCount(data.online)
                }
            } catch {
                // Keep the last known/default count.
            }
        }

        fetchOnlineCount()

        const interval = window.setInterval(
            fetchOnlineCount,
            30000
        )

        return () => {
            mounted = false
            window.clearInterval(interval)
        }
    }, [])

    async function signOut() {
        await supabase.auth.signOut()
        window.location.href = "/"
    }

    const displayName =
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email?.split("@")[0] ||
        "Account"

    const onlineLabel =
        onlineCount >= 1000
            ? `${Math.round(onlineCount / 1000)}k`
            : onlineCount.toLocaleString()

    return (
        <header className="siteHeader">
            <div className="headerInner">
                <div className="headerLeft">
                    <a href="/" className="siteBrand">
                        <img
                            src="https://framerusercontent.com/images/uGdsn8V7FG4qrMfIKZjL5lxDo.png"
                            alt="Telehub"
                        />
                        <span>Telehub</span>
                    </a>

                    <div className="onlineChip">
                        <span className="onlineDot" />
                        <span>Online: {onlineLabel}</span>
                    </div>
                </div>

                <div className="desktopHeaderActions">
                    {loading ? (
                        <div className="headerLoading">Loading...</div>
                    ) : user ? (
                        <>
                            <a
                                href="/profile"
                                className="headerButton profileButton"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2C74F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <span>{displayName}</span>
                            </a>

                            <a
                                href="/add-channel"
                                className="headerButton addChannelButton"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>Add Your Channel</span>
                            </a>

                            <a
                                href="/dashboard"
                                className="headerButton"
                            >
                                Dashboard
                            </a>

                            <button
                                type="button"
                                className="headerButton"
                                onClick={signOut}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                <span>Sign out</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <a
                                href="/login"
                                className="headerButton"
                            >
                                Log in
                            </a>
                            <a
                                href="/signup"
                                className="headerButton addChannelButton"
                            >
                                Sign up
                            </a>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    className="mobileMenuButton"
                    onClick={() => setMenuOpen((value) => !value)}
                    aria-expanded={menuOpen}
                    aria-label="Open menu"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="4" y1="6" x2="20" y2="6" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="18" x2="20" y2="18" />
                    </svg>
                    <span>Menu</span>
                </button>
            </div>

            {menuOpen ? (
                <div className="mobileMenuPanel">
                    {user ? (
                        <>
                            <a href="/profile">{displayName}</a>
                            <a href="/add-channel">Add Your Channel</a>
                            <a href="/dashboard">Dashboard</a>
                            <button type="button" onClick={signOut}>
                                Sign out
                            </button>
                        </>
                    ) : (
                        <>
                            <a href="/login">Log in</a>
                            <a href="/signup">Sign up</a>
                        </>
                    )}
                </div>
            ) : null}
        </header>
    )
}
