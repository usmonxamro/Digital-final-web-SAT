const ICONS: Record<string, string> = {
  'graduation-cap': '<path d="m2 10 10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5M22 10v6"/>',
  house: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-8h6v8"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  layers: '<path d="m12 2 10 6-10 6L2 8zM2 12l10 6 10-6M2 16l10 6 10-6"/>',
  'book-open': '<path d="M12 7c-3-3-7-3-10-2v15c4-1 8-1 10 2 2-3 6-3 10-2V5c-3-1-7-1-10 2zM12 7v15"/>',
  'calendar-days': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M7 14h2M12 14h2"/>',
  'chart-no-axes-column-increasing': '<path d="M3 21v-5h4v5M10 21v-10h4v10M17 21V4h4v17"/>',
  'user-round': '<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
  crown: '<path d="m2 7 5 4 5-7 5 7 5-4-2 13H4z"/>',
  'arrow-right': '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10M10 22h4"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="m7 4 13 8-13 8z"/>',
  trophy: '<path d="M7 3h10v8a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 16v4m-4 1h8"/>',
  calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8v4H8zM8 14h1m4 0h1m-6 4h1m4 0h1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m12 12 8-9"/>',
  pencil: '<path d="m4 20 4-1 12-12-3-3L5 16zM15 6l3 3"/>',
  'calendar-check': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18m5 5 2 2 4-4"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
}

/** The dashboard design's inline icons (same shapes as the supplied design). */
export function SbIcon({ name }: { name: keyof typeof ICONS | string }) {
  return (
    <i
      data-icon={name}
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ICONS.target}</svg>`,
      }}
    />
  )
}
