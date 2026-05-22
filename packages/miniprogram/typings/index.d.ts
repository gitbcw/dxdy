/// <reference path="./types/index.d.ts" />

interface IAppOption extends Record<string, any> {
  globalData: {
    userInfo?: any,
    token?: string,
    userRole?: string,
    catalogSearchKeyword?: string,
    openid?: string,
    authResolved?: boolean,
    cartVersion?: number,
  }
  restoreCachedUser?: () => void
  ensureLogin?: () => void
  getRoleHomePath?: (role?: string) => string
  goRoleHome?: () => void
  resolveRole?: (user: any) => string
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}
