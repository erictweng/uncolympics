import { useParams } from 'react-router-dom'

function TitleReveal() {
  const { roomCode, gameId } = useParams<{ roomCode: string; gameId: string }>()
  
  return (
    <div>
      <h1>Title Reveal</h1>
      <p>Room Code: {roomCode}</p>
      <p>Game ID: {gameId}</p>
      <p>Animated title reveals and scoring</p>
    </div>
  )
}

export default TitleReveal