export function OrbDisplay({ state, recording, onMouseDown, onMouseUp }) {
  const colors = {
    idle: '#378ADD',
    thinking: '#7F77DD',
    speaking: '#1D9E75',
  }
  const color = recording ? '#E84A5F' : (colors[state] || colors.idle)

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={(e) => { e.preventDefault(); onMouseDown() }}
      onTouchEnd={(e) => { e.preventDefault(); onMouseUp() }}
      style={{
        position: 'relative',
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {[100, 120, 140].map((size, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            border: `1px solid ${color}`,
            opacity: (recording || state !== 'idle') ? 0.4 : 0.15,
            animation: `pulse ${1.5 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.4s',
          zIndex: 2,
          transform: recording ? 'scale(1.1)' : 'scale(1)',
          transition: 'background 0.4s, transform 0.1s',
        }}
      >
        <span style={{ fontSize: 28, color: '#fff' }}>
          {recording ? '◼' : state === 'speaking' ? '◈' : state === 'thinking' ? '◎' : '◉'}
        </span>
      </div>
    </div>
  )
}