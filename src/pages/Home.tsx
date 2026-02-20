import { Link } from 'react-router-dom'
import { useReconnect } from '../hooks/useReconnect'

function Home() {
  // Attempt to reconnect user on page load
  useReconnect()

  return (
    <div className="text-center space-y-12">
      {/* Title */}
      <div className="mb-16">
        <h1 className="text-6xl md:text-8xl font-bold text-accent-primary neon-glow-primary mb-4">
          UNCOLYMPICS
        </h1>
        <p className="text-xl md:text-2xl text-secondary">
          Real-time party Olympics scoring
        </p>
      </div>

      {/* Action Buttons */}
      <div className="space-y-8">
        <Link to="/create">
          <button className="w-full max-w-md bg-secondary hover:bg-accent-primary hover:text-black text-accent-primary border-2 border-accent-primary neon-border-primary font-bold text-2xl py-6 px-12 rounded-lg transition-all duration-300 transform hover:scale-105">
            CREATE TOURNAMENT
          </button>
        </Link>

        <Link to="/join">
          <button className="w-full max-w-md bg-secondary hover:bg-accent-secondary hover:text-black text-accent-secondary border-2 border-accent-secondary neon-border-secondary font-bold text-2xl py-6 px-12 rounded-lg transition-all duration-300 transform hover:scale-105">
            JOIN TOURNAMENT
          </button>
        </Link>

        {/* Tournament History Link */}
        <div className="mt-8">
          <Link to="/history">
            <button className="w-full max-w-md bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 font-medium text-lg py-4 px-8 rounded-lg transition-all duration-300">
              📜 Past Tournaments
            </button>
          </Link>
        </div>
      </div>

      {/* Footer Text */}
      <div className="mt-16 text-secondary">
        <p>Choose your path to Olympic glory!</p>
      </div>
    </div>
  )
}

export default Home