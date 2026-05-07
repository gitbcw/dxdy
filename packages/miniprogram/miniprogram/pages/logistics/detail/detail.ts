const { getOrderById } = require('../../../services/index')

function getLatestTrack(tracks: any[]) {
  return tracks.find((track: any) => track.active) || tracks[0] || null
}

Page({
  data: {
    orderId: '',
    status: '待发货',
    desc: '订单已创建，等待商家录入物流',
    orderNo: '',
    company: '待录入',
    trackingNo: '',
    shipTime: '待发货',
    eta: '待更新',
    temperature: '常温配送',
    tracks: [] as any[],
    isEmpty: false,
  },

  onLoad(options: any) {
    const orderId = options.orderId || options.id
    if (orderId) {
      this.loadLogistics(orderId)
    } else {
      this.setData({ isEmpty: true })
    }
  },

  async loadLogistics(orderId: string) {
    const order = await getOrderById(orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      this.setData({ isEmpty: true })
      return
    }

    const shipping = order.shipping || {}
    const paidTrack = order.payment?.paidAt
      ? [{ title: '订单已支付', time: order.payment.paidAt, active: true, desc: `支付金额 ¥${order.payment.amount || order.pricing?.actualAmount || 0}` }]
      : []
    const logistics = (shipping.logistics || []).map((item: any) => ({
      title: item.title || item.description || '物流更新',
      time: item.time || shipping.shippedAt || order.updatedAt,
      active: true,
      desc: item.description || item.location || '',
    }))
    const futureTrack = shipping.trackingNo
      ? [{ title: order.status === 'completed' ? '已签收' : '待签收', time: shipping.eta || '预计送达时间待更新', active: order.status === 'completed', desc: order.status === 'completed' ? '订单已完成' : '' }]
      : [{ title: '等待发货', time: '商家录入物流后更新', active: false }]
    const tracks = [...paidTrack, ...logistics, ...futureTrack].reverse()
    const latest = getLatestTrack(tracks)

    this.setData({
      orderId: order.id,
      status: shipping.trackingNo ? (order.status === 'completed' ? '已签收' : '配送中') : '待发货',
      desc: latest?.desc || (shipping.trackingNo ? '物流信息已同步' : '订单已创建，等待商家录入物流'),
      orderNo: order.orderNo || order.id,
      company: shipping.company || '待录入',
      trackingNo: shipping.trackingNo || '',
      shipTime: shipping.shippedAt || '待发货',
      eta: shipping.eta || '待更新',
      temperature: shipping.temperature || '常温配送',
      tracks,
      isEmpty: false,
    })
  },

  onCopy() {
    if (!this.data.trackingNo) {
      wx.showToast({ title: '暂无物流单号', icon: 'none' })
      return
    }
    wx.setClipboardData({ data: this.data.trackingNo })
  },
})

export {}
