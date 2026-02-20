import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

// Import page components
import Home from './pages/Home'
import CreateTournament from './pages/CreateTournament'
import JoinTournament from './pages/JoinTournament'
import Lobby from './pages/Lobby'
import GamePick from './pages/GamePick'
import GamePlay from './pages/GamePlay'
import TitleReveal from './pages/TitleReveal'
import Scoreboard from './pages/Scoreboard'
import Ceremony from './pages/Ceremony'
import History from './pages/History'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateTournament />} />
          <Route path="/join" element={<JoinTournament />} />
          <Route path="/lobby/:roomCode" element={<Lobby />} />
          <Route path="/game/:roomCode/pick" element={<GamePick />} />
          <Route path="/game/:roomCode/play/:gameId" element={<GamePlay />} />
          <Route path="/game/:roomCode/reveal/:gameId" element={<TitleReveal />} />
          <Route path="/scoreboard/:roomCode" element={<Scoreboard />} />
          <Route path="/ceremony/:roomCode" element={<Ceremony />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App