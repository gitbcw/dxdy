function toSvgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const clock = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="26" fill="#EAF5F3" stroke="#0A6E7C" stroke-width="4"/>
    <path d="M32 18v16l11 7" fill="none" stroke="#0A6E7C" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>
  </svg>
`)

export const refresh = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M14 30a18 18 0 0 1 31-11l5-5v14H36l5-5A12 12 0 0 0 20 30" fill="none" stroke="#0A6E7C" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>
    <path d="M50 34a18 18 0 0 1-31 11l-5 5V36h14l-5 5a12 12 0 0 0 21-7" fill="none" stroke="#0A6E7C" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>
  </svg>
`)

export const emptyOrder = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect x="14" y="16" width="36" height="32" rx="6" fill="#F5FAF9" stroke="#0A6E7C" stroke-width="4"/>
    <path d="M22 26h20M22 34h14" fill="none" stroke="#0A6E7C" stroke-linecap="round" stroke-width="4"/>
    <circle cx="46" cy="44" r="8" fill="#EAF5F3" stroke="#0A6E7C" stroke-width="4"/>
    <path d="m43 44 2 2 4-4" fill="none" stroke="#0A6E7C" stroke-linecap="round" stroke-linejoin="round" stroke-width="4"/>
  </svg>
`)

export const share = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="18" cy="32" r="7" fill="#EAF5F3" stroke="#0A6E7C" stroke-width="4"/>
    <circle cx="46" cy="18" r="7" fill="#EAF5F3" stroke="#0A6E7C" stroke-width="4"/>
    <circle cx="46" cy="46" r="7" fill="#EAF5F3" stroke="#0A6E7C" stroke-width="4"/>
    <path d="M24 29l15-8M24 35l15 8" fill="none" stroke="#0A6E7C" stroke-linecap="round" stroke-width="4"/>
  </svg>
`)
