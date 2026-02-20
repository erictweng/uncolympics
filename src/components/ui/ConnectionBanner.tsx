import useGameStore from '../../stores/gameStore';

export function ConnectionBanner() {
  const connectionStatus = useGameStore(s => s.connectionStatus);
  
  if (connectionStatus === 'connected' || !connectionStatus) return null;
  
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-bold ${
      connectionStatus === 'reconnecting' ? 'bg-yellow-500 text-black' : 'bg-red-500 text-white'
    }`}>
      {connectionStatus === 'reconnecting' ? '⏳ Reconnecting...' : '❌ Disconnected'}
    </div>
  );
}