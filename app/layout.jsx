import './globals.css'

export const metadata = {
  title: 'Workmivo | Gestiona tu negocio',
  description: 'Organiza clientes, cotizaciones, trabajos y facturas.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0d3330" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Workmivo" />
      </head>
      <body>{children}</body>
    </html>
  )
}
