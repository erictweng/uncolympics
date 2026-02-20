import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useGameStore from '../stores/gameStore'
import { ConnectionBanner } from './ui/ConnectionBanner'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  const { tournament } = useGameStore()
  const location = useLocation()
  
  // Don't show scoreboard button if we're already on scoreboard page
  const isScoreboardPage = location.pathname.includes('/scoreboard/')
  
  return (
    <div className="min-h-screen bg-primary">
      <ConnectionBanner />
      {/* Header */}
      <header className="bg-secondary border-b-2 border-accent-primary">
        <div className="max-w-4xl mx-auto px-4 py-6 relative">
          <h1 className="text-4xl font-bold text-accent-primary neon-glow-primary text-center">
            UNCOLYMPICS
          </h1>
          
          {/* Scoreboard Button - only show if tournament is active and not on scoreboard page */}
          {tournament && !isScoreboardPage && (
            <Link
              to={`/scoreboard/${tournament.room_code}`}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 text-2xl transition-colors neon-glow-secondary"
              title="View Scoreboard"
            >
              📊
            </Link>
          )}
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