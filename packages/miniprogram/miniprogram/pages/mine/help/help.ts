type HelpRole = 'customer_personal' | 'customer_institution' | 'salesperson' | 'clerk'

const FAQS_BY_ROLE: Record<HelpRole, Array<{
  id: number
  question: string
  answer: string
  open: boolean
}>> = {
  customer_personal: [
    {
      id: 1,
      question: '如何购买商品？',
      answer: '可以在首页或分类页浏览商品，加入购物车后提交订单并完成支付。',
      open: false,
    },
    {
      id: 2,
      question: '订单发货后多久能收到？',
      answer: '常规商品一般 1-3 个工作日送达，冷链或特殊商品会根据配送条件同步物流进度。',
      open: false,
    },
    {
      id: 3,
      question: '如何申请退换货？',
      answer: '进入订单详情后可发起售后申请，提交原因后由客服审核处理。',
      open: false,
    },
    {
      id: 4,
      question: '支付后为什么订单状态还没变化？',
      answer: '支付完成后状态会自动更新，如遇延迟可稍后刷新页面或联系官方客服。',
      open: false,
    },
  ],
  customer_institution: [
    {
      id: 1,
      question: '机构客户如何进行商品采购？',
      answer: '认证通过后，可在首页和分类页查看适用商品并直接下单采购。',
      open: false,
    },
    {
      id: 2,
      question: '如何获取机构专属价格？',
      answer: '完成机构认证后会自动展示对应价格和可采购范围，无需单独申请。',
      open: false,
    },
    {
      id: 3,
      question: '预约服务和普通商品采购有什么区别？',
      answer: '普通商品按订单流程发货，预约服务会在下单后进入确认与履约流程。',
      open: false,
    },
    {
      id: 4,
      question: '机构订单如何查看处理进度？',
      answer: '进入订单详情即可查看当前状态、物流信息以及后续售后处理进度。',
      open: false,
    },
  ],
  salesperson: [
    {
      id: 1,
      question: '推广工具怎么使用？',
      answer: '业务员可直接使用专属推广二维码，邀请客户扫码注册小程序。',
      open: false,
    },
    {
      id: 2,
      question: '客户注册后会怎么归属？',
      answer: '通过业务员推广进入并完成注册的客户，会沉淀到对应的客户管理列表中。',
      open: false,
    },
    {
      id: 3,
      question: '如何查看客户跟进情况？',
      answer: '进入客户管理页，可查看客户类型、下单次数、累计采购额和售后情况。',
      open: false,
    },
    {
      id: 4,
      question: '佣金可以提现吗？',
      answer: '进入“我的佣金”可查看可提现金额，达到条件后即可发起提现申请。',
      open: false,
    },
  ],
  clerk: [
    {
      id: 1,
      question: '待处理订单在哪里看？',
      answer: '进入首页待办事项或“待处理订单”页面，可查看当前需要发货的订单。',
      open: false,
    },
    {
      id: 2,
      question: '如何录入快递单号？',
      answer: '打开订单详情后选择快递公司并填写或扫码录入快递单号，即可提交发货。',
      open: false,
    },
    {
      id: 3,
      question: '换货单和普通单有什么区别？',
      answer: '换货单会带有换货标识，处理时需要优先关注关联原订单和补发信息。',
      open: false,
    },
    {
      id: 4,
      question: '录入发货后客户能同步看到吗？',
      answer: '提交成功后，订单状态和物流信息会同步到客户侧页面展示。',
      open: false,
    },
  ],
}

const ROLE_COPY: Record<HelpRole, { title: string; countLabel: string }> = {
  customer_personal: { title: '个人客户常见问题', countLabel: '个人客户' },
  customer_institution: { title: '机构客户常见问题', countLabel: '机构客户' },
  salesperson: { title: '业务员常见问题', countLabel: '业务员' },
  clerk: { title: '制单员常见问题', countLabel: '制单员' },
}

Page({
  data: {
    currentRole: 'customer_personal' as HelpRole,
    roleTitle: '个人客户常见问题',
    roleCountLabel: '个人客户',
    faqs: [] as any[],
    contacts: [
      { type: '客服热线', value: '400-888-6688', icon: '电', action: 'call' },
      { type: '工作时间', value: '周一至周六 9:00-18:00', icon: '时', action: '' },
      { type: '服务邮箱', value: 'service@dxdy-lab.com', icon: '邮', action: 'copy' },
    ] as any[],
  },

  onShow() {
    this.loadRoleFaqs()
  },

  loadRoleFaqs() {
    const app = getApp()
    const role = (app.globalData.userRole || 'customer_personal') as HelpRole
    const safeRole = FAQS_BY_ROLE[role] ? role : 'customer_personal'
    const roleCopy = ROLE_COPY[safeRole]
    const faqs = FAQS_BY_ROLE[safeRole].map((item) => ({ ...item, open: false }))

    this.setData({
      currentRole: safeRole,
      roleTitle: roleCopy.title,
      roleCountLabel: roleCopy.countLabel,
      faqs,
    })
  },

  onToggleFaq(e: any) {
    const id = e.currentTarget.dataset.id
    const faqs = this.data.faqs.map((f: any) =>
      f.id === id ? { ...f, open: !f.open } : f
    )
    this.setData({ faqs })
  },

  onContactAction(e: any) {
    const action = e.currentTarget.dataset.action
    if (action === 'call') {
      wx.makePhoneCall({ phoneNumber: '400-888-6688' })
    } else if (action === 'copy') {
      wx.setClipboardData({
        data: 'service@dxdy-lab.com',
        success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' }),
      })
    }
  },

  onCallService() {
    wx.makePhoneCall({ phoneNumber: '400-888-6688' })
  },

  onCopyEmail() {
    wx.setClipboardData({
      data: 'service@dxdy-lab.com',
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' }),
    })
  },

  onOnlineService() {
    wx.showToast({ title: '在线客服即将上线', icon: 'none' })
  },
})

export {}
