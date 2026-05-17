Page({
  data: {
    userInfo: null as any,
    fields: [] as any[],
    avatarUrl: '',
    showAvatarPicker: false,
  },

  onShow() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) {
      wx.navigateBack()
      return
    }

    const isAgent = user.role === 'salesperson' || user.agentStatus === 'approved'
    const isClerk = user.role === 'clerk'
    const roleLabel = isAgent ? '代理商' : isClerk ? '制单员' : (user.roleName || '普通客户')
    const fields = [
      { key: 'avatar', label: '头像', value: '', type: 'avatar' },
      { key: 'nickname', label: '昵称', value: user.nickname || '', type: 'text' },
      { key: 'phone', label: '手机号', value: user.phone || '未绑定', type: 'text' },
      { key: 'role', label: '角色', value: roleLabel, type: 'readonly' },
      { key: 'createdAt', label: '注册时间', value: user.createdAt || '2025-01-15', type: 'readonly' },
    ]

    if (!isAgent && !isClerk) {
      fields.splice(
        3,
        0,
        { key: 'email', label: '邮箱', value: user.email || '未绑定', type: 'text' },
        { key: 'company', label: '所属机构', value: user.company || '未关联', type: 'readonly' },
      )
    }

    this.setData({
      userInfo: user,
      avatarUrl: user.avatar || user.avatarUrl || '',
      fields,
    })
  },

  updateLocalAvatar(avatarUrl: string) {
    const app = getApp()
    const user = {
      ...(this.data.userInfo || {}),
      avatar: avatarUrl,
      avatarUrl,
    }
    app.globalData.userInfo = user
    wx.setStorageSync('current_user', JSON.stringify(user))
    this.setData({ userInfo: user, avatarUrl })
  },

  onFieldTap(e: any) {
    const key = e.currentTarget.dataset.key
    const field = this.data.fields.find((f: any) => f.key === key)
    if (!field || field.type === 'readonly') return

    if (key === 'avatar') {
      wx.showActionSheet({
        itemList: ['选择本地图片', '读取微信头像'],
        success: (res: any) => {
          if (res.tapIndex === 0) {
            this.chooseLocalAvatar()
            return
          }
          this.openWechatAvatarPicker()
        },
      })
      return
    }

    wx.showModal({
      title: `修改${field.label}`,
      editable: true,
      placeholderText: `请输入${field.label}`,
      content: field.value,
      success: (res) => {
        if (res.confirm && res.content) {
          const fields = this.data.fields.map((f: any) =>
            f.key === key ? { ...f, value: res.content } : f
          )
          this.setData({ fields })
          wx.showToast({ title: '修改成功（本地预览）', icon: 'none' })
        }
      },
    })
  },

  chooseLocalAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res: any) => {
        const avatarUrl = res.tempFiles?.[0]?.tempFilePath
        if (!avatarUrl) return
        this.updateLocalAvatar(avatarUrl)
        wx.showToast({ title: '头像已更新', icon: 'success' })
      },
    })
  },

  openWechatAvatarPicker() {
    this.setData({ showAvatarPicker: true })
  },

  onChooseAvatar(e: any) {
    const avatarUrl = e.detail?.avatarUrl
    if (!avatarUrl) return
    this.updateLocalAvatar(avatarUrl)
    this.setData({ showAvatarPicker: false })
    wx.showToast({ title: '头像已更新', icon: 'success' })
  },

  closeAvatarPicker() {
    this.setData({ showAvatarPicker: false })
  },

  noop() {},
})

export {}
