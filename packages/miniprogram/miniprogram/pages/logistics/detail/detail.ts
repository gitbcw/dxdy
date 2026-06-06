const { GENERATED_ASSETS, getOrderById, queryLogistics } = require('../../../services/index')

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
    realtime: false,
    isDirectDelivery: false,
    providerMessage: '',
    coldChainImage: GENERATED_ASSETS.coldChain,
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
    const result = await queryLogistics(orderId)
    const order = result?.order || await getOrderById(orderId)
    if (!order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      this.setData({ isEmpty: true })
      return
    }

    const shipping = order.shipping || {}
    const directDelivery = shipping.directDelivery || {}
    const isDirectDelivery = shipping.deliveryMode === 'direct' || directDelivery.status === 'departed'
    const providerTracks = result?.success && Array.isArray(result.provider?.tracks)
      ? result.provider.tracks.map((item: any) => ({
        title: item.title || '物流更新',
        time: item.time || '',
        active: true,
        desc: item.desc || '',
      }))
      : []
    const paidTrack = order.payment?.paidAt
      ? [{ title: '订单已支付', time: order.payment.paidAt, active: true, desc: `支付金额 ¥${order.payment.amount || order.pricing?.actualAmount || 0}` }]
      : []
    const logistics = (shipping.logistics || []).map((item: any) => ({
      title: item.title || item.description || '物流更新',
      time: item.time || shipping.shippedAt || order.updatedAt,
      active: true,
      desc: item.description || item.location || '',
    }))
    const directTracks = isDirectDelivery
      ? [{
        title: '制单员已出发',
        time: directDelivery.departedAt || shipping.shippedAt || order.updatedAt,
        active: true,
        desc: `预计 ${directDelivery.estimatedArrivalAt || shipping.eta || '待更新'} 到达`,
      }]
      : []
    const futureTrack = isDirectDelivery
      ? [{ title: order.status === 'completed' ? '已送达' : '等待送达', time: directDelivery.estimatedArrivalAt || shipping.eta || '预计到达时间待更新', active: order.status === 'completed', desc: order.status === 'completed' ? '订单已完成' : '制单员正在加急配送' }]
      : shipping.trackingNo
      ? [{ title: order.status === 'completed' ? '已签收' : '待签收', time: shipping.eta || '预计送达时间待更新', active: order.status === 'completed', desc: order.status === 'completed' ? '订单已完成' : '' }]
      : [{ title: '等待发货', time: '商家录入物流后更新', active: false }]
    const tracks = providerTracks.length
      ? providerTracks
      : [...paidTrack, ...logistics, ...directTracks, ...futureTrack].reverse()
    const latest = getLatestTrack(tracks)
    const providerMessage = result?.success
      ? (result.provider?.providerMessage || (result.realtime ? '物流轨迹已同步' : '暂无实时轨迹，展示平台物流记录'))
      : (result?.error || '')

    this.setData({
      orderId: order.id,
      status: isDirectDelivery ? (order.status === 'completed' ? '已送达' : '加急配送中') : shipping.trackingNo ? (order.status === 'completed' ? '已签收' : '配送中') : '待发货',
      desc: latest?.desc || providerMessage || (isDirectDelivery ? '制单员已出发，正在加急配送' : shipping.trackingNo ? '物流信息已同步' : '订单已创建，等待商家录入物流'),
      orderNo: order.orderNo || order.id,
      company: isDirectDelivery ? '制单员线下配送' : result?.provider?.company || shipping.company || '待录入',
      trackingNo: isDirectDelivery ? '' : result?.provider?.trackingNo || shipping.trackingNo || '',
      shipTime: shipping.shippedAt || '待发货',
      eta: directDelivery.estimatedArrivalAt || shipping.eta || '待更新',
      temperature: shipping.temperature || '常温配送',
      tracks,
      realtime: !!(result?.success && result.realtime && providerTracks.length),
      isDirectDelivery,
      providerMessage,
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
