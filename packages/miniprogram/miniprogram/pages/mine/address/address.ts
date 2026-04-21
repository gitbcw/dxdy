Page({
  data: {
    addresses: [
      {
        id: 1,
        name: '张伟',
        phone: '138****6789',
        province: '广东省',
        city: '广州市',
        district: '天河区',
        detail: '珠江新城华夏路30号合景国际金融广场12楼',
        isDefault: true,
        tag: '公司',
      },
      {
        id: 2,
        name: '张伟',
        phone: '138****6789',
        province: '广东省',
        city: '广州市',
        district: '番禺区',
        detail: '南村镇万博二路79号万达广场B栋3204',
        isDefault: false,
        tag: '家',
      },
      {
        id: 3,
        name: '李芳',
        phone: '139****1234',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '科技园南区科苑路15号科兴科学园B3单元602',
        isDefault: false,
        tag: '',
      },
    ] as any[],
  },

  onSetDefault(e: any) {
    const id = e.currentTarget.dataset.id
    const addresses = this.data.addresses.map((a: any) => ({
      ...a,
      isDefault: a.id === id,
    }))
    this.setData({ addresses })
    wx.showToast({ title: '已设为默认', icon: 'success' })
  },

  onEdit(e: any) {
    const id = e.currentTarget.dataset.id
    wx.showToast({ title: `编辑地址 ${id}`, icon: 'none' })
  },

  onDelete(e: any) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: (res) => {
        if (res.confirm) {
          const addresses = this.data.addresses.filter((a: any) => a.id !== id)
          this.setData({ addresses })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      },
    })
  },

  onAddAddress() {
    wx.showToast({ title: '新增地址（开发中）', icon: 'none' })
  },
})

export {}
