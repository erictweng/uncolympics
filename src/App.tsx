import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import Layout from './components/Layout'
import { PageTransition } from './components/PageTransition'
import { setNavigate } from './lib/navigation'

// Import page components
import Home from './pages/Home'
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
    <Router basename="/uncolympics">
      <NavigationSetter />
      <ScrollToTop />
      <Layout>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/create" element={<PageTransition><CreateTournament /></PageTransition>} />
            <Route path="/join" element={<PageTransition><JoinTournament /></PageTransition>} />
            <Route path="/lobby/:roomCode" element={<PageTransition><Lobby /></PageTransition>} />
            <Route path="/team-select/:roomCode" element={<PageTransition><TeamSelection /></PageTransition>} />
            <Route path="/game/:roomCode/pick" element={<PageTransition><GamePick /></PageTransition>} />
            <Route path="/game/:roomCode/play/:gameId" element={<PageTransition><GamePlay /></PageTransition>} />
            <Route path="/game/:roomCode/reveal/:gameId" element={<PageTransition><TitleReveal /></PageTransition>} />
            <Route path="/scoreboard/:roomCode" element={<PageTransition><Scoreboard /></PageTransition>} />
            <Route path="/ceremony/:roomCode" element={<PageTransition><Ceremony /></PageTransition>} />
            <Route path="/history" element={<PageTransition><History /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </Router>
  )
}

export default App