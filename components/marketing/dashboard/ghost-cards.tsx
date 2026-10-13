/** Faded "new mocks are being prepared" cards, so the catalogue never looks empty or finished. */
export function GhostCards({ count = 3, label = 'Tez orada' }: { count?: number; label?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div className="sd-ghost" key={i} aria-hidden>
          <span className="sd-ghost-tag">{label}</span>
          <i className="sd-g-ico" />
          <i className="sd-g-t" />
          <i className="sd-g-l" />
          <i className="sd-g-l sd-s" />
        </div>
      ))}
    </>
  )
}
