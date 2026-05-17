export function StatusBar({ time, connected, activeAgent }) {
  const fmt = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  const fmtDate = (d) => d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="top-bar">
      <div>
        <div className="clock">{fmt(time)}</div>
        <div className="date">{fmtDate(time)}</div>
      </div>
      <div className="pills">
        <span className={`pill ${connected ? 'pill-green' : 'pill-red'}`}>
          {connected ? 'Terhubung' : 'Terputus'}
        </span>
        {activeAgent && <span className="pill pill-blue">{activeAgent}</span>}
      </div>
    </div>
  )
}