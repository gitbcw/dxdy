type Species = 'dog' | 'cat'
type ProductType = 'whole' | 'rbc' | 'plasma'
type FormulaMode = 'precise' | 'rough'

interface OptionItem {
  label: string
  value: string
}

interface ResultItem {
  label: string
  value: string
  desc: string
}

function toNumber(value: string | number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return String(round(value))
}

function normalizePcv(value: number): number {
  if (value > 1) return value / 100
  return value
}

function isInstitutionUser() {
  const app = getApp()
  const user = app.globalData.userInfo || {}
  const role = app.globalData.userRole
  return role === 'customer_institution' || user.customerType === 'institution'
}

Page({
  data: {
    species: 'dog' as Species,
    productType: 'whole' as ProductType,
    formulaMode: 'rough' as FormulaMode,
    weight: '',
    currentPcv: '',
    targetPcv: '',
    productPcv: '',
    bloodVolume: '',
    results: [] as ResultItem[],
    resultTip: '',
    speciesOptions: [
      { label: '犬', value: 'dog' },
      { label: '猫', value: 'cat' },
    ] as OptionItem[],
    productOptions: [
      { label: '全血', value: 'whole' },
      { label: '悬浮红细胞', value: 'rbc' },
      { label: '血浆', value: 'plasma' },
    ] as OptionItem[],
    formulaOptions: [
      { label: '粗算公式', value: 'rough' },
      { label: '精准公式', value: 'precise' },
    ] as OptionItem[],
    indications: [
      {
        name: '全血 / 去白细胞全血',
        desc: '急性出血性贫血，不适用于血容量正常的贫血治疗，或血小板减少、凝血因子Ⅴ、Ⅶ缺乏的患病动物。',
        note: '输血前需严格核对血型，必须交叉配血后才能输注。',
      },
      {
        name: '悬浮红细胞 / 去白悬浮红细胞',
        desc: '适用于各种原因引起的症状性贫血，如溶血、慢性贫血等，尤其适合血容量正常或存在心脏、肾脏疾病的患病动物，可避免容量超负荷。',
        note: '输血前需严格核对血型，必须交叉配血后才能输注。',
      },
      {
        name: '新鲜冰冻血浆',
        desc: '遗传性凝血因子缺乏、获得性凝血障碍、创伤性凝血病、需补充所有凝血因子等情况。',
        note: '使用前需在37℃水浴锅震荡回温10分钟，确保受热均匀，复温后必须24h内使用完。',
      },
      {
        name: '冰冻血浆',
        desc: '维生素K拮抗剂中毒等需要补充稳定凝血因子的情况，不适用于治疗不稳定因子Ⅴ、Ⅷ相关缺乏症。',
        note: '使用前需在37℃水浴锅震荡回温10分钟，确保受热均匀，复温后必须24h内使用完。',
      },
    ],
    crossMatchSteps: [
      {
        no: '1',
        title: '样品准备',
        lines: [
          '准备6支空白试管，分别标记血液制剂/受血者全血、血液制剂/受血者血浆、血液制剂/受血者细胞液。',
          '分别采集血液制剂/受血者血液1mL，放入EDTA管/非抗凝管中。',
          '低速离心2500-3000r/min 5min，将离心后的血浆/血清分别放入对应试管中。',
        ],
      },
      {
        no: '2',
        title: '红细胞悬浮液制备',
        lines: [
          '取血液制剂和受血者红细胞0.2mL放入标记好的试管中。',
          '加入适当生理盐水，沿管壁缓慢加入4.8mL生理盐水轻柔混匀。',
          '低速离心5min，弃去上清液，重复3-5次；取洗好的红细胞8μL、生理盐水200μL，制备成5%红细胞悬浮液。',
        ],
      },
      {
        no: '3',
        title: '加样与混合',
        lines: [
          '主侧交叉配血：2滴受血动物血浆 + 1滴供血动物红细胞悬浮液。',
          '次侧交叉配血：2滴供血动物血浆 + 1滴受血动物红细胞悬浮液。',
          '受血动物自身对照：2滴受血动物血浆 + 1滴受血动物红细胞悬浮液。',
          '供血动物自身对照：2滴供血动物血浆 + 1滴供血动物红细胞悬浮液。',
        ],
      },
      { no: '4', title: '孵育', lines: ['将试管置于37℃条件下孵育15min。'] },
      { no: '5', title: '离心', lines: ['孵育后以1000×g离心15s。'] },
      {
        no: '6',
        title: '结果判定',
        lines: [
          '显微镜观察：取一滴反应物于载玻片上，加盖玻片后镜检。',
          '红细胞应呈均匀分散状态，无凝集或缗钱状形成。',
          '主侧、副侧均未发生凝集：可以输血；主侧凝集、副侧未凝集：不可以输血。',
        ],
      },
    ],
  },

  onLoad() {
    if (isInstitutionUser()) return
    wx.showToast({ title: '仅医院客户可使用', icon: 'none' })
    setTimeout(() => wx.navigateBack(), 400)
  },

  selectOption(e: any) {
    const field = e.currentTarget.dataset.field
    const value = e.currentTarget.dataset.value
    const next: Record<string, any> = { [field]: value, results: [], resultTip: '' }
    if (field === 'productType' && value === 'plasma') next.formulaMode = 'rough'
    this.setData(next)
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value, results: [], resultTip: '' })
  },

  calculate() {
    const weight = toNumber(this.data.weight)
    if (weight <= 0) {
      wx.showToast({ title: '请输入体重', icon: 'none' })
      return
    }

    if (this.data.productType === 'plasma') {
      this.calculatePlasma(weight)
      return
    }

    const currentPcv = normalizePcv(toNumber(this.data.currentPcv))
    const targetPcv = normalizePcv(toNumber(this.data.targetPcv))
    if (currentPcv <= 0 || targetPcv <= 0 || targetPcv <= currentPcv) {
      wx.showToast({ title: '请输入合理的当前/目标红细胞压积', icon: 'none' })
      return
    }

    if (this.data.formulaMode === 'precise') {
      const productPcv = normalizePcv(toNumber(this.data.productPcv))
      if (productPcv <= 0) {
        wx.showToast({ title: '请输入制剂红细胞压积', icon: 'none' })
        return
      }
      const factor = this.data.species === 'dog' ? 90 : 66
      const amount = factor * weight * (targetPcv - currentPcv) / productPcv
      this.setData({
        results: [{
          label: '建议输注量',
          value: `${formatNumber(amount)} mL`,
          desc: `${this.data.species === 'dog' ? '犬' : '猫'}${this.data.productType === 'whole' ? '全血' : '悬浮红细胞'}精准公式计算结果`,
        }],
        resultTip: `精准公式：输血量(mL)=${factor}×体重(kg)×(目标红细胞压积-当前红细胞压积)/制剂红细胞压积。HCT/PCV 可输入 0.18 或 18，两者均按 18% 处理。`,
      })
      return
    }

    const amount = 2.2 * weight * (targetPcv - currentPcv) * 100
    this.setData({
      results: [{
        label: '建议输注量',
        value: `${formatNumber(amount)} mL`,
        desc: `${this.data.species === 'dog' ? '犬' : '猫'}${this.data.productType === 'whole' ? '全血' : '悬浮红细胞'}粗算公式计算结果`,
      }],
      resultTip: '粗算公式：输血量(mL)=2.2×体重(kg)×(目标红细胞压积-当前红细胞压积)×100。HCT/PCV 可输入 0.18 或 18，两者均按 18% 处理。',
    })
  },

  calculatePlasma(weight: number) {
    const startMin = 6 * weight
    const startMax = 10 * weight
    const normalMin = 10 * weight
    const normalMax = 15 * weight
    const upper = this.data.species === 'dog' ? 20 * weight : 15 * weight
    this.setData({
      results: [
        { label: '起始剂量', value: `${formatNumber(startMin)}-${formatNumber(startMax)} mL`, desc: '6-10 mL/kg' },
        { label: '常规剂量', value: `${formatNumber(normalMin)}-${formatNumber(normalMax)} mL`, desc: '10-15 mL/kg' },
        { label: '输注上限', value: `${formatNumber(upper)} mL`, desc: this.data.species === 'dog' ? '犬上限20 mL/kg' : '猫上限10-15 mL/kg' },
      ],
      resultTip: '血浆输注量：起始剂量6-10mL/kg，常规剂量10-15mL/kg；犬上限20mL/kg，猫上限10-15mL/kg。',
    })
  },
})

export {}
