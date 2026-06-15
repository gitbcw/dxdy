const { getAgentApplication } = require('../../../services/index')

Page({
  data: {
    status: 'none',
    info: {} as any,
    statusCopy: {
      title: '尚未提交申请',
      desc: '提交代理商资料后可在这里查看审核进度',
      icon: '代',
      tone: 'none',
    },
  },

  onShow() {
    this.loadStatus()
  },

  async loadStatus() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) {
      this.setStatus('none', {})
      return
    }
    const result = await getAgentApplication()
    if (result?.user) {
      app.globalData.userInfo = result.user
      app.globalData.userRole = app.resolveRole?.(result.user) || app.globalData.userRole
      wx.setStorageSync('current_user', JSON.stringify(result.user))
      wx.setStorageSync('user_role', app.globalData.userRole)
    }
    const status = result?.status || 'none'
    this.setStatus(status, result?.info || {})
  },

  setStatus(status: string, info: any) {
    const copyMap: Record<string, any> = {
      none: {
        title: '尚未提交申请',
        desc: '提交代理商资料后可在这里查看审核进度',
        icon: '代',
        tone: 'none',
      },
      pending_review: {
        title: '申请审核中',
        desc: '资料已进入审核队列，预计 1-3 个工作日完成审核',
        icon: '审',
        tone: 'pending',
      },
      approved: {
        title: '代理商已通过',
        desc: '可使用专属推广码、客户管理和提成中心',
        icon: '✓',
        tone: 'approved',
      },
      rejected: {
        title: '申请被驳回',
        desc: info?.rejectReason || '资料不完整或暂不符合合作要求',
        icon: '!',
        tone: 'rejected',
      },
    }
    this.setData({
      status,
      info,
      statusCopy: copyMap[status] || copyMap.none,
    })
  },

  onApplyTap() {
    wx.navigateTo({ url: '/pages/agent/apply/apply' })
  },

  onPromoteTap() {
    wx.navigateTo({ url: '/pages/agent/promote/promote' })
  },

  onCommissionTap() {
    wx.navigateTo({ url: '/pages/agent/commission/commission' })
  },

  onBackTap() {
    wx.navigateBack()
  },
})

export {}
