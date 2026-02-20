export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mb-4"></div>
      <p className="text-gray-400">{message}</p>
    </div>
  );
}