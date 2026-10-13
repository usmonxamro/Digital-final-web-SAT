export default function Loading() {
  return (
    <div style={{ padding: '24px 4px' }} aria-busy="true" aria-label="Yuklanmoqda">
      <div style={{ height: 28, width: 220, borderRadius: 10, background: 'rgba(120,150,190,.18)', marginBottom: 18 }} />
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 120, borderRadius: 16, background: 'rgba(120,150,190,.12)' }} />
        ))}
      </div>
    </div>
  )
}
