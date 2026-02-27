import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import Layout from './components/Layout'
import { PageTransition } from './components/PageTransition'
import { AuthGuard } from './components/AuthGuard'
import { setNavigate } from './lib/navigation'

// Import page components
import Home from './pages/Home'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import CreateTournament from './pages/CreateTournament'
import JoinTournament from './pages/JoinTournament'
import Lobby from './pages/Lobby'
import GamePick from './pages/GamePick'
import GamePlay from './pages/GamePlay'
import TitleReveal from './pages/TitleReveal'
import Scoreboard from './pages/Scoreboard'
import TeamSelection from './pages/TeamSelection'
import Ceremony from './pages/Ceremony'
import History from './pages/History'
import GameSetup from './pages/GameSetup'
import GameHub from './pages/GameHub'
import Draft from './pages/Draft'

function NavigationSetter() {
  const navigate = useNavigate();
  useEffect(() => { setNavigate(navigate); }, [navigate]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <NavigationSetter />
      <ScrollToTop />
      <Layout>
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected routes */}
            <Route path="/" element={<AuthGuard><PageTransition><Home /></PageTransition></AuthGuard>} />
            <Route path="/create" element={<AuthGuard><PageTransition><CreateTournament /></PageTransition></AuthGuard>} />
            <Route path="/join" element={<AuthGuard><PageTransition><JoinTournament /></PageTransition></AuthGuard>} />
            <Route path="/lobby/:roomCode" element={<AuthGuard><PageTransition><Lobby /></PageTransition></AuthGuard>} />
            <Route path="/team-select/:roomCode" element={<AuthGuard><PageTransition><TeamSelection /></PageTransition></AuthGuard>} />
            <Route path="/game-setup/:roomCode" element={<AuthGuard><PageTransition><GameSetup /></PageTransition></AuthGuard>} />
            <Route path="/draft/:roomCode" element={<AuthGuard><PageTransition><Draft /></PageTransition></AuthGuard>} />
            <Route path="/game-hub/:roomCode" element={<AuthGuard><PageTransition><GameHub /></PageTransition></AuthGuard>} />
            <Route path="/game/:roomCode/pick" element={<AuthGuard><PageTransition><GamePick /></PageTransition></AuthGuard>} />
            <Route path="/game/:roomCode/play/:gameId" element={<AuthGuard><PageTransition><GamePlay /></PageTransition></AuthGuard>} />
            <Route path="/game/:roomCode/reveal/:gameId" element={<AuthGuard><PageTransition><TitleReveal /></PageTransition></AuthGuard>} />
            <Route path="/scoreboard/:roomCode" element={<AuthGuard><PageTransition><Scoreboard /></PageTransition></AuthGuard>} />
            <Route path="/ceremony/:roomCode" element={<AuthGuard><PageTransition><Ceremony /></PageTransition></AuthGuard>} />
            <Route path="/history" element={<AuthGuard><PageTransition><History /></PageTransition></AuthGuard>} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </Router>
  )
}

export default App
