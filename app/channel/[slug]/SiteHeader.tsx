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
                                <span aria-hidden="true">♙</span>
                                <span>{displayName}</span>
                            </a>

                            <a
                                href="/add-channel"
                                className="headerButton addChannelButton"
                            >
                                <span aria-hidden="true">＋</span>
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
                                <span aria-hidden="true">↪</span>
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
                    <span aria-hidden="true">☰</span>
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
