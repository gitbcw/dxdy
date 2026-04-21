Page({
  data: {
    userInfo: null as any,
    fields: [] as any[],
  },

  onShow() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) {
      wx.navigateBack()
      return
    }
    this.setData({
      userInfo: user,
      fields: [
        { key: 'avatar', label: '头像', value: '', type: 'avatar' },
        { key: 'nickname', label: '昵称', value: user.nickname || '', type: 'text' },
        { key: 'phone', label: '手机号', value: user.phone || '未绑定', type: 'text' },
        { key: 'email', label: '邮箱', value: user.email || '未绑定', type: 'text' },
        { key: 'role', label: '角色', value: user.roleName || '个人客户', type: 'readonly' },
        { key: 'company', label: '所属机构', value: user.company || '未关联', type: 'readonly' },
        { key: 'createdAt', label: '注册时间', value: user.createdAt || '2025-01-15', type: 'readonly' },
      ],
    })
  },

  onFieldTap(e: any) {
    const key = e.currentTarget.dataset.key
    const field = this.data.fields.find((f: any) => f.key === key)
    if (!field || field.type === 'readonly') return

    if (key === 'avatar') {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        success: () => wx.showToast({ title: '头像更新（开发中）', icon: 'none' }),
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
})

export {}
