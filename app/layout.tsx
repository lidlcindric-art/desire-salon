import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Desire — Frizerski salon, Središće Zagreb',
  description: 'Frizerski salon Desire — Vojina Bakića 12, Središće Zagreb. Ženske i muške frizure, boja, pramenovi, Yodeyma parfemi. Rezerviraj online!',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600&family=Inter:wght@300;400;500&family=Cormorant+Garamond:ital,wght@0,400;1,400;1,500&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#150218" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  )
}
