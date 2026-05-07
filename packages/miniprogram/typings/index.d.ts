/// <reference path="./types/index.d.ts" />

interface IAppOption extends Record<string, any> {
  globalData: {
    userInfo?: any,
    token?: string,
    userRole?: string,
    catalogSearchKeyword?: string,
    openid?: string,
  }
  loadUserByOpenId?: (openid: string) => Promise<void>
  resolveRole?: (user: any) => string
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}
