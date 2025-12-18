export default function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e] text-[#eee] font-sans">
      <div className="text-center">
        <div className="text-2xl mb-2.5">Loading Physics Engine...</div>
        <div className="text-sm opacity-70">Initializing WASM module</div>
      </div>
    </div>
  )
}
