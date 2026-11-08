export function LeafMark() {
  return (
    <svg className="leaf" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M18 4c2.2 6 8 8.2 8 15a8 8 0 0 1-16 0c0-6.8 5.8-9 8-15z" fill="currentColor" opacity=".9" />
      <path d="M18 8c.5 5 3 7.5 3 11.5" fill="none" stroke="var(--gold)" strokeWidth="1.4" />
    </svg>
  )
}

export function WoodlandScene() {
  return (
    <svg className="scene" viewBox="0 0 760 360" role="img" aria-label="A woodland village">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset="1" stopColor="var(--sky-bottom)" />
        </linearGradient>
      </defs>
      <rect width="760" height="360" fill="url(#sky)" />
      <g className="only-night">
        {[[80, 40], [140, 70], [230, 36], [310, 84], [420, 28], [510, 60], [600, 34], [690, 78]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="var(--star)" />
        ))}
      </g>
      <circle className="only-day" cx="620" cy="68" r="28" fill="var(--sun)" />
      <circle className="only-night" cx="600" cy="64" r="22" fill="var(--moon)" />
      <g className="cloud" fill="#fff" opacity=".72">
        <ellipse cx="150" cy="70" rx="46" ry="16" />
        <ellipse cx="180" cy="62" rx="28" ry="16" />
      </g>
      <g className="cloud" fill="#fff" opacity=".55">
        <ellipse cx="430" cy="54" rx="36" ry="12" />
      </g>
      <path d="M0 210 C120 170 180 190 280 176 C390 160 460 200 560 184 C650 172 700 190 760 176 V360 H0 Z" fill="var(--hill-far)" />
      <path d="M0 240 C140 210 220 250 340 226 C470 200 540 246 760 214 V360 H0 Z" fill="var(--hill-mid)" />
      <path d="M40 268 C120 250 160 286 230 270 C300 254 330 292 400 274" fill="none" stroke="var(--water)" strokeWidth="10" strokeLinecap="round" />
      <path d="M250 250 h70 v8 h-8 v18 h-54 v-18 h-8 z" fill="var(--bark)" opacity=".85" />
      <g>
        <rect x="300" y="188" width="92" height="62" rx="4" fill="var(--wall)" />
        <path d="M286 192 L346 150 L406 192 Z" fill="var(--roof)" />
        <rect className="window-glow" x="318" y="204" width="16" height="18" fill="var(--window)" />
        <rect className="window-glow" x="352" y="204" width="16" height="18" fill="var(--window)" />
        <rect x="338" y="222" width="14" height="28" fill="var(--bark)" />
      </g>
      <g>
        <rect x="470" y="176" width="70" height="54" rx="3" fill="var(--wall)" />
        <path d="M458 180 L505 146 L552 180 Z" fill="var(--roof)" />
        <rect className="window-glow" x="488" y="192" width="18" height="16" fill="var(--window)" />
      </g>
      <g>
        <rect x="118" y="214" width="16" height="46" fill="var(--trunk)" />
        <circle cx="126" cy="200" r="28" fill="var(--leaf)" />
        <circle cx="146" cy="214" r="18" fill="var(--leaf-2)" />
      </g>
      <g>
        <rect x="620" y="198" width="18" height="58" fill="var(--trunk)" />
        <circle cx="629" cy="176" r="34" fill="var(--leaf)" />
        <circle cx="654" cy="196" r="20" fill="var(--leaf-2)" />
      </g>
      <path d="M0 300 C160 280 240 320 400 300 C560 280 620 320 760 296 V360 H0 Z" fill="var(--hill-near)" />
      <g className="only-night firefly">
        <circle cx="210" cy="230" r="2.2" fill="#f2d48a" />
        <circle cx="540" cy="210" r="1.8" fill="#f2d48a" />
        <circle cx="250" cy="250" r="1.5" fill="#f6e7b2" />
      </g>
      <g className="only-day" fill="var(--rose)">
        <circle cx="90" cy="318" r="4" />
        <circle cx="104" cy="322" r="3" />
        <circle cx="680" cy="326" r="4" />
      </g>
    </svg>
  )
}

export function NotebookCover({ cover }: { cover: string }) {
  const night = cover === 'moon' || cover === 'stars' || cover === 'lantern'
  return (
    <svg viewBox="0 0 160 210" aria-hidden="true">
      <rect width="160" height="210" fill={night ? '#1b2c40' : '#d7ebe4'} />
      <rect width="14" height="210" fill="currentColor" opacity=".35" />
      {night ? <circle cx="118" cy="42" r="16" fill="#f4e7c8" /> : <circle cx="124" cy="38" r="14" fill="#f0c56b" />}
      {cover === 'stars' && (
        <g fill="#f4e7c8">
          <circle cx="36" cy="28" r="1.4" />
          <circle cx="58" cy="46" r="1.2" />
          <circle cx="88" cy="24" r="1.3" />
        </g>
      )}
      <path d="M0 150 C40 128 78 162 118 140 C140 128 152 148 160 138 V210 H0 Z" fill={night ? '#1d4636' : '#5f916f'} />
      {cover !== 'river' && cover !== 'fern' && (
        <g>
          <rect x="58" y="108" width="44" height="32" fill="#f6ecda" />
          <path d="M50 112 L80 86 L110 112 Z" fill="#8a5638" />
          <rect x="74" y="122" width="12" height="18" fill="#6d4c34" />
        </g>
      )}
      {cover === 'river' && <path d="M18 168 C48 150 70 176 104 160" fill="none" stroke="#7eb6ae" strokeWidth="8" strokeLinecap="round" />}
      {cover === 'floral' && (
        <g fill="#f4d7dc">
          <circle cx="36" cy="176" r="7" />
          <circle cx="52" cy="184" r="5" />
          <circle cx="26" cy="188" r="4" />
        </g>
      )}
      {cover === 'fern' && <path d="M48 70 C70 110 78 150 70 190" fill="none" stroke="#2d6848" strokeWidth="3" />}
      {cover === 'mushroom' && <path d="M96 156 q16 -28 32 0 v8 h-32 z" fill="#f2d7c4" />}
      {cover === 'lantern' && <rect x="108" y="120" width="14" height="22" rx="4" fill="#e7d3a4" />}
      {cover === 'moon' && <path d="M20 170 h26 v6 h-4 v10 h-18 v-10 h-4 z" fill="#6d4c34" />}
    </svg>
  )
}
