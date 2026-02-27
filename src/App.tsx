import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import Layout from './components/Layout'
import { PageTransition } from './components/PageTransition'
import { AuthGuard } from './components/AuthGuard'
import { SurveyGuard } from './components/SurveyGuard'
import { setNavigate } from './lib/navigation'

// Import page components
import Home from './pages/Home'
import Survey from './pages/Survey'
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
import OpeningCeremony from './pages/OpeningCeremony'

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

            {/* Auth-only (no survey required) */}
            <Route path="/survey" element={<AuthGuard><PageTransition><Survey /></PageTransition></AuthGuard>} />

            {/* Fully protected routes (auth + survey) */}
            <Route path="/" element={<AuthGuard><SurveyGuard><PageTransition><Home /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/create" element={<AuthGuard><SurveyGuard><PageTransition><CreateTournament /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/join" element={<AuthGuard><SurveyGuard><PageTransition><JoinTournament /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/lobby/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><Lobby /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/team-select/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><TeamSelection /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/game-setup/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><GameSetup /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/ceremony-open/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><OpeningCeremony /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/draft/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><Draft /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/game-hub/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><GameHub /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/game/:roomCode/pick" element={<AuthGuard><SurveyGuard><PageTransition><GamePick /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/game/:roomCode/play/:gameId" element={<AuthGuard><SurveyGuard><PageTransition><GamePlay /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/game/:roomCode/reveal/:gameId" element={<AuthGuard><SurveyGuard><PageTransition><TitleReveal /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/scoreboard/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><Scoreboard /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/ceremony/:roomCode" element={<AuthGuard><SurveyGuard><PageTransition><Ceremony /></PageTransition></SurveyGuard></AuthGuard>} />
            <Route path="/history" element={<AuthGuard><SurveyGuard><PageTransition><History /></PageTransition></SurveyGuard></AuthGuard>} />
          </Routes>
        </AnimatePresence>
      </Layout>
    </Router>
  )
}

export default App
