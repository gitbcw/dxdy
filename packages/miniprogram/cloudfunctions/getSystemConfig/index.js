const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const defaultConfig = {
  commissionRate: 0.2,
  commissionLockDays: 15,
  minWithdrawAmount: 100,
  withdrawReviewEnabled: true,
  paymentTimeoutMinutes: 30,
  autoReceiptDays: 7,
  returnDeadlineDays: 7,
  returnAddress: '',
  reviewTimeoutHours: 24,
  stockWarningThreshold: 10,
  pointsRate: 1,
  pointsExpiryDays: 365,
  rechargeTiers: [],
  bloodBookingConfig: {
    dogBloodTypes: [
      'DEA1.1阳性',
      'DEA1.1阴性',
      'DEA1.1阴性 + DEA7阴性',
      'DEA7阴性',
      '未检测，需协助配血',
    ],
    catBloodTypes: ['A型', 'B型', 'AB型', '未检测，需协助配血'],
    dogVolumeOptions: [100, 200, 300, 400, 500],
    catVolumeOptions: [50, 100, 150, 200],
    priceRules: [],
  },
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function normalizePriceRule(rule) {
  const legacyPrice = roundMoney(rule && rule.price)
  const storePrice = roundMoney((rule && rule.storePrice) || legacyPrice)
  const retailPrice = roundMoney((rule && rule.retailPrice) || (storePrice > 0 ? storePrice * 2 : 0))
  return {
    species: rule && rule.species,
    bloodType: rule && rule.bloodType,
    volumeMl: Number(rule && rule.volumeMl),
    storePrice,
    retailPrice,
  }
}

function normalizeBloodBookingConfig(config) {
  const merged = {
    ...defaultConfig.bloodBookingConfig,
    ...(config || {}),
  }
  const priceRules = Array.isArray(merged.priceRules)
    ? merged.priceRules.map(normalizePriceRule).filter((rule) => (
      ['dog', 'cat'].includes(rule.species) &&
      rule.bloodType &&
      Number.isFinite(rule.volumeMl) &&
      rule.volumeMl > 0
    ))
    : []
  return { ...merged, priceRules }
}

exports.main = async () => {
  try {
    const { data } = await db.collection('config').doc('system').get()
    const config = {
      ...defaultConfig,
      ...(data || {}),
      bloodBookingConfig: normalizeBloodBookingConfig(data && data.bloodBookingConfig),
    }
    return { success: true, config }
  } catch (e) {
    return { success: true, config: defaultConfig }
  }
}
