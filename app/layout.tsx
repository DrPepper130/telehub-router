import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
    title: {
        default: "TeleHub",
        template: "%s | TeleHub",
    },
    description:
        "Discover Telegram channels and groups on TeleHub.",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
