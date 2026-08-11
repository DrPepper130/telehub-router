"use client"

export default function BackToListings() {
    function goBack() {
        const params = new URLSearchParams(window.location.search)
        const from = params.get("from")

        if (
            from &&
            from.startsWith("/") &&
            !from.startsWith("//")
        ) {
            window.location.href = from
            return
        }

        try {
            const savedRaw = window.sessionStorage.getItem(
                "telehub_listing_return"
            )

            if (savedRaw) {
                const saved = JSON.parse(savedRaw)
                const savedUrl = String(saved?.url || "")

                if (
                    savedUrl.startsWith("/") &&
                    !savedUrl.startsWith("//")
                ) {
                    window.location.href = savedUrl
                    return
                }
            }
        } catch {
            // Ignore malformed session storage data.
        }

        if (window.history.length > 1) {
            window.history.back()
            return
        }

        window.location.href = "/all"
    }

    return (
        <button
            type="button"
            className="backToListings"
            onClick={goBack}
            aria-label="Return to previous listings results"
        >
            ‹ Back to listings
        </button>
    )
}
