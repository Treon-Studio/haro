export function Waveform({ active }) {
  const bars = 12
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 32 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: active ? `${12 + Math.random() * 20}px` : '4px',
            background: 'rgba(255,255,255,0.4)',
            borderRadius: 2,
            animation: active ? `wave ${0.4 + i * 0.05}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  )
}