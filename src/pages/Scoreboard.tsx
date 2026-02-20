import { useParams } from 'react-router-dom'

function Scoreboard() {
  const { roomCode } = useParams<{ roomCode: string }>()
  
  return (
    <div>
      <h1>Scoreboard</h1>
      <p>Room Code: {roomCode}</p>
      <p>Current team standings and title totals</p>
    </div>
  )
}

export default Scoreboard