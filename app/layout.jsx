import './globals.css'

export const metadata = {
  title: 'Workmivo | Gestiona tu negocio',
  description: 'Organiza clientes, cotizaciones, trabajos y facturas.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
