import { useParams } from 'react-router-dom'

function Ceremony() {
  const { roomCode } = useParams<{ roomCode: string }>()
  
  return (
    <div>
      <h1>Awards Ceremony</h1>
      <p>Room Code: {roomCode}</p>
      <p>Final awards ceremony and winner announcement</p>
    </div>
  )
}

export default Ceremony