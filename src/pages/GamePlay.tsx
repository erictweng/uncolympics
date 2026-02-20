import { useParams } from 'react-router-dom'

function GamePlay() {
  const { roomCode, gameId } = useParams<{ roomCode: string; gameId: string }>()
  
  return (
    <div>
      <h1>Game Play</h1>
      <p>Room Code: {roomCode}</p>
      <p>Game ID: {gameId}</p>
      <p>Live game - input stats and results</p>
    </div>
  )
}

export default GamePlay