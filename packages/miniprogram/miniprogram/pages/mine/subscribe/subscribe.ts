const icons = require('../../../services/icons')

type WxWithOfficialAccount = WechatMiniprogram.Wx & {
  openOfficialAccountProfile?: (options: {
    username: string
    success?: () => void
    fail?: (err: any) => void
  }) => void
}

Page({
  data: {
    bellIcon: icons.subscribe,
    officialAccountId: 'gh_e403f58ec23a',
    officialAccountName: '大熊动医',
    tips: [
      '关注官方公众号，获取品牌动态、服务资讯与宠物医疗科普内容。',
      '公众号将不定期推送养护知识、活动信息与官方公告。',
    ],
  },

  onOpenOfficialAccount() {
    ;(wx as WxWithOfficialAccount).openOfficialAccountProfile?.({
      username: this.data.officialAccountId,
      success: () => {
        console.log('打开公众号资料页成功')
      },
      fail: (err: any) => {
        console.error('打开公众号资料页失败', err)
        wx.showModal({
          title: '跳转失败',
          content: '请确认公众号已与小程序完成关联，或稍后重试。',
          showCancel: false,
        })
      },
    })
  },

})

export {}
