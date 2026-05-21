type Species = 'dog' | 'cat'
type DogBloodValue = 'negative' | 'positive' | 'unknown'
type CatBloodValue = 'A' | 'B' | 'AB' | 'unknown'
type Choice = 'yes' | 'no'

interface OptionItem {
  label: string
  value: string
}

interface MatchResult {
  title: string
  compatible: string[]
  forbidden: string[]
  notes: string[]
}

function dogValueLabel(value: DogBloodValue) {
  if (value === 'positive') return '阳性'
  if (value === 'negative') return '阴性'
  return '未知'
}

function buildDogCompatible(dea11: DogBloodValue, dea7: DogBloodValue) {
  const dea11Options = dea11 === 'negative' ? ['DEA1.1阴性'] : ['DEA1.1阴性', 'DEA1.1阳性']
  const dea7Options = dea7 === 'negative' ? ['DEA7阴性'] : ['DEA7阴性', 'DEA7阳性']
  const list: string[] = []

  dea11Options.forEach((a) => {
    dea7Options.forEach((b) => {
      list.push(`${a} + ${b}`)
    })
  })

  return list
}

function buildDogResult(dea11: DogBloodValue, dea7: DogBloodValue, priorTransfusion: Choice, highRisk: Choice): MatchResult {
  const notes = [
    '犬输血前建议完成交叉配血，非首次输血、妊娠/繁育或长期贫血病例必须交叉配血。',
    'DEA1.1阴性 + DEA7阴性通常可作为更优先的供血犬筛选方向。',
  ]

  if (priorTransfusion === 'yes' || highRisk === 'yes') {
    notes.push('当前条件属于高风险场景，建议优先同型或更严格筛选供血犬，并由兽医确认。')
  }

  if (dea11 === 'unknown' || dea7 === 'unknown') {
    return {
      title: '建议先补充犬血型鉴定',
      compatible: ['急诊无法等待时，优先考虑 DEA1.1阴性 + DEA7阴性供血犬，并立即做交叉配血。'],
      forbidden: ['未完成血型鉴定和交叉配血前，避免直接使用 DEA1.1阳性或 DEA7阳性供血犬。'],
      notes,
    }
  }

  const forbidden: string[] = []
  if (dea11 === 'negative') forbidden.push('DEA1.1阳性供血犬')
  if (dea7 === 'negative') forbidden.push('DEA7阳性供血犬')

  return {
    title: `受血犬：DEA1.1${dogValueLabel(dea11)}，DEA7${dogValueLabel(dea7)}`,
    compatible: buildDogCompatible(dea11, dea7),
    forbidden: forbidden.length ? forbidden : ['无按 DEA1.1/DEA7 直接排除的供血类型，仍需交叉配血。'],
    notes,
  }
}

function buildCatResult(catType: CatBloodValue, emergency: Choice): MatchResult {
  const notes = [
    '猫天然抗体强，任何猫输血都必须做主/次交叉配血。',
    'AB型供血猫通常只建议供给AB型受血猫。',
  ]

  if (catType === 'unknown') {
    return {
      title: '建议先完成猫 A/B/AB 血型鉴定',
      compatible: ['急诊无法等待时，需在兽医评估下完成快速血型检测与交叉配血后再输血。'],
      forbidden: ['未明确血型前，不建议经验性输入 A型、B型或AB型血。'],
      notes,
    }
  }

  if (catType === 'A') {
    return {
      title: '受血猫：A型',
      compatible: emergency === 'yes' ? ['首选 A型供血猫', '急诊且交叉配血通过时，可由兽医评估少量 AB型血'] : ['A型供血猫'],
      forbidden: ['B型供血猫'],
      notes,
    }
  }

  if (catType === 'B') {
    return {
      title: '受血猫：B型',
      compatible: ['B型供血猫'],
      forbidden: ['A型供血猫', 'AB型供血猫'],
      notes: notes.concat('B型猫输入A型血风险极高，应严格禁止。'),
    }
  }

  return {
    title: '受血猫：AB型',
    compatible: ['首选 AB型供血猫', '交叉配血通过时，可由兽医评估 A型或B型供血猫'],
    forbidden: ['无仅按血型直接排除的类型，但不得跳过交叉配血。'],
    notes,
  }
}

Page({
  data: {
    species: 'dog' as Species,
    dogDea11: 'unknown' as DogBloodValue,
    dogDea7: 'unknown' as DogBloodValue,
    dogPriorTransfusion: 'no' as Choice,
    dogHighRisk: 'no' as Choice,
    catBloodType: 'unknown' as CatBloodValue,
    catEmergency: 'no' as Choice,
    result: null as MatchResult | null,
    speciesOptions: [
      { label: '犬', value: 'dog' },
      { label: '猫', value: 'cat' },
    ] as OptionItem[],
    dogBloodOptions: [
      { label: '未知', value: 'unknown' },
      { label: '阴性', value: 'negative' },
      { label: '阳性', value: 'positive' },
    ] as OptionItem[],
    catBloodOptions: [
      { label: '未知', value: 'unknown' },
      { label: 'A型', value: 'A' },
      { label: 'B型', value: 'B' },
      { label: 'AB型', value: 'AB' },
    ] as OptionItem[],
    yesNoOptions: [
      { label: '否', value: 'no' },
      { label: '是', value: 'yes' },
    ] as OptionItem[],
  },

  selectSpecies(e: any) {
    const species = e.currentTarget.dataset.value as Species
    this.setData({ species, result: null })
  },

  selectOption(e: any) {
    const field = e.currentTarget.dataset.field
    const value = e.currentTarget.dataset.value
    this.setData({ [field]: value, result: null })
  },

  generateResult() {
    const data = this.data
    const result = data.species === 'dog'
      ? buildDogResult(data.dogDea11, data.dogDea7, data.dogPriorTransfusion, data.dogHighRisk)
      : buildCatResult(data.catBloodType, data.catEmergency)

    this.setData({ result })
  },
})

export {}
