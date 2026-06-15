function toSvgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function iconSvg(body: string, options: { color?: string; fill?: string } = {}) {
  const color = options.color || '#0A6E7C'
  const fill = options.fill || '#EAF5F3'
  return toSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="18" fill="${fill}"/>
      <g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        ${body}
      </g>
    </svg>
  `)
}

function solidSvg(body: string, options: { color?: string; fill?: string } = {}) {
  const color = options.color || '#16A34A'
  const fill = options.fill || '#EAF8EE'
  return toSvgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="18" fill="${fill}"/>
      <g fill="${color}">
        ${body}
      </g>
    </svg>
  `)
}

export const search = iconSvg('<circle cx="28" cy="28" r="13"/><path d="m39 39 9 9"/>', { color: '#8B95A1', fill: '#FFFFFF' })
export const filter = iconSvg('<path d="M14 18h36L36 34v12l-8 4V34L14 18z"/>', { color: '#27313A', fill: '#FFFFFF' })
export const phone = iconSvg('<path d="M24 14h16a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"/><path d="M29 45h6"/>', { color: '#6B7280', fill: '#FFFFFF' })
export const user = iconSvg('<circle cx="32" cy="24" r="8"/><path d="M18 50c2-10 8-15 14-15s12 5 14 15"/>', { color: '#6B7280', fill: '#FFFFFF' })
export const shield = iconSvg('<path d="M32 12 48 18v12c0 11-6 19-16 24-10-5-16-13-16-24V18l16-6z"/><path d="m24 32 6 6 12-14"/>', { color: '#6B7280', fill: '#FFFFFF' })

export const home = iconSvg('<path d="M14 31 32 16l18 15"/><path d="M20 30v20h24V30"/><path d="M28 50V38h8v12"/>')
export const catalog = iconSvg('<rect x="16" y="16" width="12" height="12" rx="3"/><rect x="36" y="16" width="12" height="12" rx="3"/><rect x="16" y="36" width="12" height="12" rx="3"/><rect x="36" y="36" width="12" height="12" rx="3"/>')
export const cart = iconSvg('<path d="M16 18h5l5 24h20l5-16H26"/><circle cx="30" cy="48" r="3"/><circle cx="44" cy="48" r="3"/>', { color: '#FF6A00', fill: '#FFF4E8' })
export const mine = iconSvg('<circle cx="32" cy="23" r="8"/><path d="M18 50c2-10 8-15 14-15s12 5 14 15"/>')

export const order = iconSvg('<rect x="17" y="14" width="30" height="38" rx="5"/><path d="M24 24h16M24 32h16M24 40h10"/>')
export const allOrders = order
export const payment = iconSvg('<rect x="14" y="20" width="36" height="26" rx="5"/><path d="M14 28h36M22 38h10"/>', { color: '#FF6A00', fill: '#FFF4E8' })
export const receipt = iconSvg('<path d="M18 16h28v34l-5-3-5 3-4-3-5 3-5-3-4 3V16z"/><path d="M25 27h14M25 36h10"/>')
export const completed = iconSvg('<circle cx="32" cy="32" r="18"/><path d="m23 32 6 7 13-15"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const clock = iconSvg('<circle cx="32" cy="32" r="18"/><path d="M32 21v13l9 6"/>')
export const refresh = iconSvg('<path d="M16 30a16 16 0 0 1 27-10l5-5v14H34"/><path d="M48 34a16 16 0 0 1-27 10l-5 5V35h14"/>')

export const building = iconSvg('<path d="M18 50V18h28v32"/><path d="M25 26h4M35 26h4M25 34h4M35 34h4M28 50V42h8v8"/>')
export const hospital = iconSvg('<path d="M18 50V22h28v28"/><path d="M26 22v-6h12v6M32 29v13M25 35h14"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const address = iconSvg('<path d="M32 52s16-14 16-27a16 16 0 0 0-32 0c0 13 16 27 16 27z"/><circle cx="32" cy="25" r="5"/>')
export const calendar = iconSvg('<rect x="16" y="18" width="32" height="30" rx="5"/><path d="M24 14v8M40 14v8M16 28h32"/>')
export const invoice = iconSvg('<path d="M18 16h28v34l-5-3-5 3-4-3-5 3-5-3-4 3V16z"/><path d="M25 27h14M25 35h10M39 40h1"/>', { color: '#2563EB', fill: '#EEF5FF' })
export const test = iconSvg('<path d="M28 14h8v18l9 14a5 5 0 0 1-4 8H23a5 5 0 0 1-4-8l9-14V14z"/><path d="M25 42h14"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const testQuery = iconSvg('<path d="M18 16h24l8 8v26H18V16z"/><path d="M42 16v10h8"/><path d="M25 30h14M25 38h8"/><circle cx="40" cy="41" r="6"/><path d="m45 46 5 5"/>', { color: '#2563EB', fill: '#EEF5FF' })
export const transfusionAssistant = iconSvg('<path d="M32 13c7 9 12 16 12 24a12 12 0 0 1-24 0c0-8 5-15 12-24z"/><path d="m25 38 5 5 10-12"/><path d="M17 20h8M21 16v8M43 46h5M46 43v6"/>', { color: '#DC2626', fill: '#FFF1F2' })
export const returns = iconSvg('<path d="M20 23h22a8 8 0 0 1 0 16H25"/><path d="m25 15-9 8 9 8"/>', { color: '#FF6A00', fill: '#FFF4E8' })
export const service = iconSvg('<path d="M18 36v-5a14 14 0 0 1 28 0v5"/><path d="M18 36h6v10h-6zM40 36h6v10h-6z"/><path d="M40 46c-2 5-6 6-12 6"/>')
export const help = iconSvg('<circle cx="32" cy="32" r="19"/><path d="M26 27a6 6 0 0 1 12 2c0 5-6 5-6 10"/><path d="M32 47h.1"/>')

export const agent = solidSvg('<path d="M20 40c4-9 9-13 12-13s8 4 12 13v10H20V40z"/><circle cx="32" cy="20" r="8"/><path d="M16 48h32v4H16z"/>')
export const customer = iconSvg('<circle cx="24" cy="25" r="7"/><circle cx="42" cy="24" r="6"/><path d="M12 50c2-10 7-15 13-15s11 5 13 15"/><path d="M36 36c6 1 10 6 12 14"/>')
export const commission = iconSvg('<circle cx="32" cy="32" r="18"/><path d="M32 20v24M25 26c2-3 12-4 14 1 2 6-12 5-14 10-2 5 10 7 15 1"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const withdraw = iconSvg('<rect x="14" y="20" width="36" height="28" rx="5"/><path d="M22 30h20M32 17v18M25 28l7 7 7-7"/>', { color: '#FF6A00', fill: '#FFF4E8' })
export const qrcode = iconSvg('<rect x="16" y="16" width="11" height="11"/><rect x="37" y="16" width="11" height="11"/><rect x="16" y="37" width="11" height="11"/><path d="M37 37h5v5h6v6H37zM31 16v8M31 37v11"/>')
export const voucher = iconSvg('<path d="M16 24a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v6a5 5 0 0 0 0 10v6a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4v-6a5 5 0 0 0 0-10v-6z"/><path d="M28 26h12M28 34h12M28 42h8"/><path d="M22 25v2M22 33v2M22 41v2"/>', { color: '#FF6A00', fill: '#FFF4E8' })
export const cardWallet = iconSvg('<path d="M16 22h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H16V22z"/><path d="M16 28h36"/><path d="M22 16h26"/><path d="M22 40h11"/><circle cx="42" cy="39" r="5"/><path d="M39 39h6"/>', { color: '#7C3AED', fill: '#F3E8FF' })
export const bank = iconSvg('<path d="M14 26h36L32 14 14 26z"/><path d="M18 30v16M28 30v16M38 30v16M48 30v16M14 50h36"/>')
export const profile = user

export const packageBox = iconSvg('<path d="M16 24 32 15l16 9v18l-16 9-16-9V24z"/><path d="m16 24 16 9 16-9M32 33v18"/>', { color: '#2563EB', fill: '#EEF5FF' })
export const truck = iconSvg('<path d="M14 24h24v18H14z"/><path d="M38 30h8l5 7v5H38z"/><circle cx="23" cy="45" r="4"/><circle cx="44" cy="45" r="4"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const pickupAddress = iconSvg('<path d="M15 26h24v18H15z"/><path d="M39 32h7l5 7v5H39z"/><circle cx="24" cy="47" r="4"/><circle cx="45" cy="47" r="4"/><path d="M32 14c5 0 9 4 9 9 0 7-9 15-9 15s-9-8-9-15c0-5 4-9 9-9z"/><circle cx="32" cy="23" r="3"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const bell = iconSvg('<path d="M20 39V29a12 12 0 0 1 24 0v10l5 7H15l5-7z"/><path d="M27 50a6 6 0 0 0 10 0"/>', { color: '#16A34A', fill: '#EAF8EE' })
export const scan = iconSvg('<path d="M18 26v-8h8M38 18h8v8M46 38v8h-8M26 46h-8v-8"/><path d="M22 32h20"/>')
export const lock = iconSvg('<rect x="18" y="29" width="28" height="21" rx="5"/><path d="M24 29v-6a8 8 0 0 1 16 0v6"/>', { color: '#6B7280', fill: '#F3F4F6' })
export const emptyOrder = iconSvg('<rect x="16" y="16" width="32" height="34" rx="6"/><path d="M24 27h16M24 36h10"/><circle cx="46" cy="46" r="7"/><path d="m43 46 2 2 4-5"/>')
export const share = iconSvg('<circle cx="19" cy="32" r="6"/><circle cx="45" cy="19" r="6"/><circle cx="45" cy="45" r="6"/><path d="m24 29 15-7M24 35l15 7"/>')
export const checkSuccess = toSvgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="44" fill="#16A34A"/>
    <path d="m38 60 15 16 30-34" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="#9BE7B0"><circle cx="28" cy="29" r="3"/><circle cx="93" cy="35" r="4"/><circle cx="88" cy="86" r="3"/></g>
  </svg>
`)

export const iconByKey: Record<string, string> = {
  home,
  catalog,
  cart,
  mine,
  order,
  allOrders,
  payment,
  receipt,
  completed,
  hospital,
  address,
  calendar,
  invoice,
  test,
  testQuery,
  transfusionAssistant,
  returns,
  service,
  help,
  agent,
  customer,
  commission,
  withdraw,
  qrcode,
  voucher,
  cardWallet,
  bank,
  profile,
  packageBox,
  truck,
  pickupAddress,
  bell,
  scan,
  building,
  blood: test,
  orders: order,
  verify: hospital,
  agentApply: agent,
  agentStatus: agent,
  promote: qrcode,
  customers: customer,
  agentOrders: order,
  cards: test,
  cardVoucherProducts: voucher,
  clerkPending: packageBox,
  clerkOrders: truck,
  booking: calendar,
  pending: packageBox,
  allorders: order,
}
