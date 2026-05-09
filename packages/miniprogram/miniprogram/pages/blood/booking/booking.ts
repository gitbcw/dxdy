const { getProducts, formatMoney, GENERATED_ASSETS } = require('../../../services/index')
const { BLOOD_MATCHING_GUIDE, getBloodCompatibility } = require('../../../data/blood-matching')

const speciesTabs = BLOOD_MATCHING_GUIDE.species.map((item: any) => ({
  key: item.key,
  label: item.label,
}))

function getSpeciesGuide(speciesKey: string) {
  return BLOOD_MATCHING_GUIDE.species.find((item: any) => item.key === speciesKey) || BLOOD_MATCHING_GUIDE.species[0]
}

function buildMatchingState(speciesKey: string, recipientType?: string, donorType?: string) {
  const guide = getSpeciesGuide(speciesKey)
  const recipient = recipientType || guide.typeOptions[0]
  const donor = donorType || guide.typeOptions[0]
  return {
    guide,
    bloodTypeOptions: guide.typeOptions,
    recipientType: recipient,
    donorType: donor,
    compatibility: getBloodCompatibility(guide.key, recipient, donor),
  }
}

const defaultMatchingState = buildMatchingState('dog')

function getProductBloodType(product: any, speciesKey: string) {
  const specValue = product.specs?.find((item: any) => /血型/.test(item.name || item.label || ''))?.value || ''
  const text = `${product.name || ''} ${product.description || ''} ${specValue}`.replace(/\s/g, '')

  if (speciesKey === 'cat') {
    if (/AB型|AB血/.test(text)) return 'AB型'
    if (/B型|B血/.test(text)) return 'B型'
    if (/A型|A血/.test(text)) return 'A型'
    return ''
  }

  if (/DEA1\.1阴性.*DEA7阴性|DEA1\.1\/7双阴性|双阴/.test(text)) return 'DEA1.1阴性/DEA7阴性'
  if (/DEA1\.1阴性/.test(text)) return 'DEA1.1阴性'
  if (/DEA1\.1阳性/.test(text)) return 'DEA1.1阳性'
  if (/DEA7阳性/.test(text)) return 'DEA7阳性'
  if (/DEA4阳性/.test(text)) return 'DEA4阳性'
  return ''
}

function getProductSpecies(product: any) {
  const text = `${product.name || ''} ${product.description || ''}`.replace(/\s/g, '')
  if (/猫/.test(text)) return 'cat'
  if (/犬|狗/.test(text)) return 'dog'
  return ''
}

function getRecommendedProducts(products: any[], speciesKey: string, recipientType: string, donorType: string) {
  const mapped = products.map((item: any) => {
    const productBloodType = getProductBloodType(item, speciesKey)
    const productSpecies = getProductSpecies(item)
    const speciesMatched = !productSpecies || productSpecies === speciesKey
    const productCompatibility = productBloodType
      ? getBloodCompatibility(speciesKey, recipientType, productBloodType)
      : null
    const donorMatched = !productBloodType || productBloodType === donorType
    const recommendScore = [
      speciesMatched ? 8 : 0,
      productCompatibility?.status === 'safe' ? 8 : productCompatibility?.status === 'warn' ? 4 : 0,
      donorMatched ? 4 : 0,
      productBloodType ? 2 : 0,
    ].reduce((sum, score) => sum + score, 0)

    return {
      ...item,
      productBloodType: productBloodType || '未标注',
      matchStatus: productCompatibility?.status || 'warn',
      matchTitle: !speciesMatched
        ? '物种待确认'
        : productCompatibility?.title || '需补充血型信息',
      matchDesc: !speciesMatched
        ? '该血制品疑似不是当前物种，请切换犬/猫或联系确认。'
        : productCompatibility?.desc || '商品暂未标注可识别血型，预约前需由客服确认分型与交叉配血结果。',
      recommendScore,
    }
  })

  return mapped.sort((a: any, b: any) => b.recommendScore - a.recommendScore)
}

function getRecommendationSummary(products: any[], speciesKey: string, recipientType: string, donorType: string) {
  if (!products.length) return '当前暂无可预约血制品。'
  const exact = products.filter((item: any) => item.productBloodType === donorType && item.matchStatus === 'safe').length
  const compatible = products.filter((item: any) => item.matchStatus === 'safe').length
  if (exact > 0) return `已优先推荐 ${exact} 个供血血型匹配且适配受血方的血制品。`
  if (compatible > 0) return `未找到完全匹配所选供血血型的商品，已优先展示 ${compatible} 个兼容血制品。`
  return `${speciesKey === 'cat' ? '猫' : '犬'} ${recipientType} 暂无明确安全匹配商品，请补充血型信息并联系人工确认。`
}

Page({
  data: {
    products: [] as any[],
    allBookingProducts: [] as any[],
    isInstitution: false,
    isVerified: false,
    isEmpty: false,
    brandLogo: GENERATED_ASSETS.brandLogo,
    speciesTabs,
    selectedSpecies: 'dog',
    guide: defaultMatchingState.guide,
    bloodTypeOptions: defaultMatchingState.bloodTypeOptions,
    recipientType: defaultMatchingState.recipientType,
    donorType: defaultMatchingState.donorType,
    compatibility: defaultMatchingState.compatibility,
    commonSafety: BLOOD_MATCHING_GUIDE.commonSafety,
    recommendationSummary: '',
  },

  onShow() {
    this.loadBookingProducts()
  },

  async loadBookingProducts() {
    const user = getApp().globalData.userInfo
    const isInstitution = user?.customerType === 'institution'
    const isVerified = user?.verificationStatus === 'approved'

    if (!isInstitution || !isVerified) {
      this.setData({
        products: [],
        isInstitution,
        isVerified,
        isEmpty: false,
      })
      return
    }

    const products = await getProducts({ visibility: 'all', categoryId: 'cat_blood' })
    const bookingProducts = products
      .filter((item: any) => item.isBloodPack && (item.visibility === 'institution_only' || item.visibility === 'all'))
      .map((item: any) => ({
        ...item,
        priceText: formatMoney(item.institutionPrice || item.personalPrice || 0),
        specText: item.specs?.[0]?.value || '标准规格',
        stockText: item.stock <= 5 ? `库存紧张 · 剩余 ${item.stock}` : `库存 ${item.stock}`,
      }))
    const recommendedProducts = getRecommendedProducts(
      bookingProducts,
      this.data.selectedSpecies,
      this.data.recipientType,
      this.data.donorType,
    )

    this.setData({
      allBookingProducts: bookingProducts,
      products: recommendedProducts,
      isInstitution,
      isVerified,
      isEmpty: bookingProducts.length === 0,
      recommendationSummary: getRecommendationSummary(
        recommendedProducts,
        this.data.selectedSpecies,
        this.data.recipientType,
        this.data.donorType,
      ),
    })
  },

  onBookTap(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/orders/create/create?productId=${id}` })
  },

  onSpeciesTap(e: any) {
    const species = e.currentTarget.dataset.species
    if (!species || species === this.data.selectedSpecies) return
    const nextState = buildMatchingState(species)
    const recommendedProducts = getRecommendedProducts(
      this.data.allBookingProducts,
      species,
      nextState.recipientType,
      nextState.donorType,
    )
    this.setData({
      selectedSpecies: species,
      ...nextState,
      products: recommendedProducts,
      recommendationSummary: getRecommendationSummary(recommendedProducts, species, nextState.recipientType, nextState.donorType),
    })
  },

  onRecipientChange(e: any) {
    const index = Number(e.detail.value || 0)
    const recipientType = this.data.bloodTypeOptions[index] || this.data.recipientType
    const nextState = buildMatchingState(this.data.selectedSpecies, recipientType, this.data.donorType)
    const recommendedProducts = getRecommendedProducts(
      this.data.allBookingProducts,
      this.data.selectedSpecies,
      nextState.recipientType,
      nextState.donorType,
    )
    this.setData({
      ...nextState,
      products: recommendedProducts,
      recommendationSummary: getRecommendationSummary(recommendedProducts, this.data.selectedSpecies, nextState.recipientType, nextState.donorType),
    })
  },

  onDonorChange(e: any) {
    const index = Number(e.detail.value || 0)
    const donorType = this.data.bloodTypeOptions[index] || this.data.donorType
    const nextState = buildMatchingState(this.data.selectedSpecies, this.data.recipientType, donorType)
    const recommendedProducts = getRecommendedProducts(
      this.data.allBookingProducts,
      this.data.selectedSpecies,
      nextState.recipientType,
      nextState.donorType,
    )
    this.setData({
      ...nextState,
      products: recommendedProducts,
      recommendationSummary: getRecommendationSummary(recommendedProducts, this.data.selectedSpecies, nextState.recipientType, nextState.donorType),
    })
  },

  onGoVerify() {
    wx.navigateTo({ url: '/pages/verify/verify' })
  },

  onGoCatalog() {
    wx.switchTab({ url: '/pages/catalog/catalog' })
  },
})

export {}
