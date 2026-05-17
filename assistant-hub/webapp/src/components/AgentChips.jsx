export function AgentChips({ onSelect }) {
  const agents = [
    { id: 'smart_home', label: 'Smart Home', icon: '⌂' },
    { id: 'calendar', label: 'Jadwal', icon: '◷' },
    { id: 'general', label: 'AI Chat', icon: '◈' },
  ]
  return (
    <div className="agent-strip">
      {agents.map(a => (
        <div key={a.id} className="agent-chip" onClick={() => onSelect(a.id)}>
          <span>{a.icon}</span>
          <span>{a.label}</span>
        </div>
      ))}
    </div>
  )
}