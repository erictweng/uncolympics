import { useParams } from 'react-router-dom'

function GamePick() {
  const { roomCode } = useParams<{ roomCode: string }>()
  
  return (
    <div>
      <h1>Game Pick</h1>
      <p>Room Code: {roomCode}</p>
      <p>Team leader selects next game</p>
    </div>
  )
}

export default GamePick