import { SatSkeleton } from '@/components/sat-loader'

/** Dashboard route transitions: skeleton cards (not a full-screen loader) — see SAT by Usmon loading kit. */
export default function Loading() {
  return (
    <div style={{ padding: '24px 4px' }}>
      <div style={{ height: 28, width: 220, borderRadius: 10, background: 'rgba(120,150,190,.18)', marginBottom: 18 }} />
      <SatSkeleton kind="cards" count={4} />
    </div>
  )
}
