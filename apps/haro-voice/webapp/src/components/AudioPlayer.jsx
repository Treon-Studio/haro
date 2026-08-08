export function AudioPlayer({ src }) {
  return src ? <audio src={src} autoPlay /> : null
}