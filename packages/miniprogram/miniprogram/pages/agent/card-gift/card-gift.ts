const { getCardById, manageCardVoucher } = require('../../../services/index')

Page({
  data: {
    card: null as any,
    customers: [] as any[],
    filteredCustomers: [] as any[],
    searchText: '',
    selectedId: '',
    selectedName: '',
    loading: false,
  },

  onLoad(options: any) {
    if (options?.id) this.loadCard(options.id)
    this.loadCustomers()
  },

  async loadCard(id: string) {
    const card = await getCardById(id)
    if (!card) { wx.showToast({ title: '卡券不存在', icon: 'none' }); return }
    this.setData({ card })
  },

  async loadCustomers() {
    const app = getApp()
    const user = app.globalData.userInfo
    if (!user) return

    const db = wx.cloud.database()
    const { data } = await db.collection('users')
      .where({
        role: 'customer',
        customerType: 'institution',
        boundSalespersonId: user.id,
      })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    const customers = (data || []).map((u: any) => ({
      id: u._id,
      name: u.nickname || u.phone || u.name || '未命名客户',
      phone: u.phone || '',
      verified: u.verificationStatus === 'approved',
    }))
    this.setData({ customers, filteredCustomers: customers })
  },

  onSearchInput(e: any) {
    const searchText = (e.detail.value || '').trim().toLowerCase()
    const filteredCustomers = searchText
      ? this.data.customers.filter((c: any) => c.name.toLowerCase().includes(searchText) || c.phone.includes(searchText))
      : this.data.customers
    this.setData({ searchText, filteredCustomers })
  },

  onSelectCustomer(e: any) {
    const { id, name } = e.currentTarget.dataset
    this.setData({ selectedId: id, selectedName: name })
  },

  async onConfirmGift() {
    const { card, selectedId } = this.data
    if (!card || !selectedId) {
      wx.showToast({ title: '请选择赠送对象', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      await manageCardVoucher({ action: 'gift', cardId: card.id, toUserId: selectedId })
      wx.showToast({ title: '赠送成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err: any) {
      wx.showToast({ title: err.message || '赠送失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },
})

export {}
