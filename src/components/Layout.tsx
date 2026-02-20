import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-primary">
      {/* Header */}
      <header className="bg-secondary border-b-2 border-accent-primary">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-4xl font-bold text-accent-primary neon-glow-primary text-center">
            UNCOLYMPICS
          </h1>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-secondary rounded-lg p-6 neon-border-primary">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="mt-16 border-t-2 border-accent-secondary bg-secondary">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-sm text-secondary">
          <p>UNCOLYMPICS - Real-time party Olympics scoring</p>
        </div>
      </footer>
    </div>
  )
}

export default Layout