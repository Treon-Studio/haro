import { useRef, useState, useCallback } from 'react'

export function useTapToTalk(sendAudio) {
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = useCallback(() => {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1]
          sendAudio(base64)
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
      }

      recorder.start()
      setRecording(true)
    }).catch(console.error)
  }, [sendAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
    }
  }, [recording])

  return { recording, startRecording, stopRecording }
}