const FULL_TAB_LIST = [
  { pagePath: '/pages/home/home', text: '首页' },
  { pagePath: '/pages/catalog/catalog', text: '分类' },
  { pagePath: '/pages/cart/cart', text: '购物车' },
  { pagePath: '/pages/mine/mine', text: '我的' },
]

const STAFF_ROLE_SET = new Set(['salesperson', 'clerk'])

function normalizePath(path: string) {
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

function getVisibleTabList(role: string) {
  if (STAFF_ROLE_SET.has(role)) {
    return FULL_TAB_LIST.filter((item) => item.pagePath === '/pages/home/home' || item.pagePath === '/pages/mine/mine')
  }

  return FULL_TAB_LIST
}

function isStaffRole(role: string) {
  return STAFF_ROLE_SET.has(role)
}

module.exports = {
  FULL_TAB_LIST,
  getVisibleTabList,
  isStaffRole,
  normalizePath,
}
