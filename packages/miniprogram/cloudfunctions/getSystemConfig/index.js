const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const defaultConfig = {
  commissionRate: 0.2,
  commissionLockDays: 15,
  minWithdrawAmount: 100,
  withdrawReviewEnabled: true,
  paymentTimeoutMinutes: 30,
  returnDeadlineDays: 7,
  returnAddress: '',
  reviewTimeoutHours: 24,
  stockWarningThreshold: 10,
  pointsRate: 1,
  pointsExpiryDays: 365,
  rechargeTiers: [],
}

exports.main = async () => {
  try {
    const { data } = await db.collection('config').doc('system').get()
    return { success: true, config: { ...defaultConfig, ...(data || {}) } }
  } catch (e) {
    return { success: true, config: defaultConfig }
  }
}
