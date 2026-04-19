/// <reference path="./types/index.d.ts" />

interface IAppOption extends Record<string, any> {
  globalData: {
    userInfo?: any,
    token?: string,
    userRole?: string,
  }
  switchDemoRole?: (role: string) => void,
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}
