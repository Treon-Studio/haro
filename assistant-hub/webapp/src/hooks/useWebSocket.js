import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

export function useWebSocket() {
  const ws = useRef(null)
  const [state, setState] = useState('idle')
  const [userText, setUserText] = useState('')
  const [assistantText, setAssistantText] = useState('')
  const [activeAgent, setActiveAgent] = useState(null)
  const [audioQueue, setAudioQueue] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    function connect() {
      ws.current = new WebSocket(WS_URL)

      ws.current.onopen = () => setConnected(true)
      ws.current.onclose = () => {
        setConnected(false)
        setTimeout(connect, 2000)
      }

      ws.current.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        switch (msg.event) {
          case 'state':
            setState(msg.state)
            if (msg.agent) setActiveAgent(msg.agent)
            if (msg.state === 'idle') {
              setActiveAgent(null)
              setTimeout(() => {
                setUserText('')
                setAssistantText('')
              }, 3000)
            }
            break
          case 'user_text':
            setUserText(msg.text)
            setAssistantText('')
            break
          case 'assistant_text':
            setAssistantText(msg.text)
            break
          case 'audio_chunk':
            setAudioQueue(q => [...q, msg.data])
            break
          case 'audio_end':
            break
        }
      }
    }
    connect()
    return () => ws.current?.close()
  }, [])

  const sendAudio = useCallback((audioBase64) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ event: 'tap_trigger', audio: audioBase64 }))
    }
  }, [])

  return { state, userText, assistantText, activeAgent, audioQueue, connected, sendAudio }
}