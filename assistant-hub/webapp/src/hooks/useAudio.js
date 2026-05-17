import { useEffect, useRef } from 'react'

export function useAudio(audioQueue, onDrained) {
  const contextRef = useRef(null)
  const nextTimeRef = useRef(0)

  useEffect(() => {
    if (!audioQueue.length) return

    if (!contextRef.current) {
      contextRef.current = new AudioContext({ sampleRate: 24000 })
    }
    const ctx = contextRef.current
    const chunk = audioQueue[audioQueue.length - 1]

    const raw = atob(chunk)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)

    ctx.decodeAudioData(bytes.buffer, (buffer) => {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      const start = Math.max(ctx.currentTime, nextTimeRef.current)
      source.start(start)
      nextTimeRef.current = start + buffer.duration
    })
  }, [audioQueue])
}