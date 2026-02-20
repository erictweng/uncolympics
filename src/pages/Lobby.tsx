import { useParams } from 'react-router-dom'

function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>()
  
  return (
    <div>
      <h1>Lobby</h1>
      <p>Room Code: {roomCode}</p>
      <p>Pick teams, choose leader, wait for start</p>
    </div>
  )
}

export default Lobby