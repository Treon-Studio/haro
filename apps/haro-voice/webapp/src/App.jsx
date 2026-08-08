import { useWebSocket } from './hooks/useWebSocket'
import { useTapToTalk } from './hooks/useTapToTalk'
import { OrbDisplay } from './components/OrbDisplay'
import { Waveform } from './components/Waveform'
import { AgentChips } from './components/AgentChips'
import { StatusBar } from './components/StatusBar'
import { useEffect, useState } from 'react'
import './styles/kiosk.css'

export default function App() {
  const { state, userText, assistantText, activeAgent, audioQueue, connected, sendAudio } = useWebSocket()
  const { recording, startRecording, stopRecording } = useTapToTalk(sendAudio)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  const stateLabel = {
    idle: recording ? 'Lepas untuk kirim...' : 'Tekan untuk bicara',
    thinking: 'Memproses...',
    speaking: 'Menjawab...',
  }[state]

  const handleAgentSelect = (agentId) => {
    console.log('Selected agent:', agentId)
  }

  return (
    <div className="hub">
      <StatusBar time={time} connected={connected} activeAgent={activeAgent} />

      <div className="center">
        <OrbDisplay
          state={state}
          recording={recording}
          onMouseDown={state === 'idle' ? startRecording : undefined}
          onMouseUp={state === 'idle' ? stopRecording : undefined}
        />
        {(state === 'speaking' || recording) && <Waveform active={true} />}
        <div className="state-label">{stateLabel}</div>
        {(userText || assistantText) && (
          <div className="bubble-area">
            {userText && <div className="bubble user-bubble">{userText}</div>}
            {assistantText && <div className="bubble assistant-bubble">{assistantText}</div>}
          </div>
        )}
      </div>

      <AgentChips onSelect={handleAgentSelect} />
    </div>
  )
}