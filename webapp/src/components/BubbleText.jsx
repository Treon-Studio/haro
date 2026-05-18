export function BubbleText({ text, className }) {
  return (
    <div className={`bubble ${className}`} style={{ padding: '10px 16px', borderRadius: 16, fontSize: 14, lineHeight: 1.5 }}>
      {text}
    </div>
  )
}