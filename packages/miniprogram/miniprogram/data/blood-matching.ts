type SpeciesKey = 'dog' | 'cat'

type CompatibilityStatus = 'safe' | 'warn' | 'danger'

interface BloodTypeRule {
  type: string
  tag: string
  matching: string
  risk: string
  attention: string
}

interface SpeciesGuide {
  key: SpeciesKey
  label: string
  subtitle: string
  primaryRule: string
  typeOptions: string[]
  universalNote: string
  mustDo: string[]
  rules: BloodTypeRule[]
}

const dogGuide: SpeciesGuide = {
  key: 'dog',
  label: '犬',
  subtitle: 'DEA1.1 是首要筛查指标，二次输血必须严格配血。',
  primaryRule: 'DEA1.1 阳性血液禁止输给 DEA1.1 阴性犬；通用供血犬需同时满足 DEA1.1 阴性和 DEA7 阴性。',
  typeOptions: ['DEA1.1阳性', 'DEA1.1阴性', 'DEA1.1阴性/DEA7阴性', 'DEA7阳性', 'DEA4阳性'],
  universalNote: '犬首次异体输血风险相对较低，但输血后会产生抗体，二次异型输血高风险。',
  mustDo: [
    '输血前优先确认 DEA1.1 分型',
    '二次输血、孕犬、多次贫血患犬必须做主次侧交叉配血',
    '前 10 分钟低速滴注并连续观察体温、尿色和黏膜颜色',
  ],
  rules: [
    {
      type: 'DEA1.1阳性',
      tag: '常见',
      matching: '可接受 DEA1.1 阳性血液，也可接受通用供血犬血液。',
      risk: '血液含强效 DEA1.1 抗原，不能供给 DEA1.1 阴性犬。',
      attention: '重点同步筛查 DEA7、DEA3 等次要血型，避免多次输血后的排斥。',
    },
    {
      type: 'DEA1.1阴性',
      tag: '稀有',
      matching: '仅可接受 DEA1.1 阴性血液，急诊优先选 DEA1.1/DEA7 双阴性血源。',
      risk: '输入 DEA1.1 阳性血液可在数分钟内引发高热、血红蛋白尿、急性肾衰或休克。',
      attention: '高危手术建议提前储备同型血源，不做异型尝试。',
    },
    {
      type: 'DEA7阳性/阴性',
      tag: '通用供血筛查',
      matching: 'DEA7 阴性犬禁止接受 DEA7 阳性血液。',
      risk: '异型输血可能导致亚急性溶血、血小板减少和输血后贫血。',
      attention: '通用供血犬必须同时满足 DEA1.1 阴性与 DEA7 阴性。',
    },
    {
      type: 'DEA4阳性',
      tag: '次要兼容',
      matching: 'DEA4 阳性/阴性通常可互通。',
      risk: '免疫原性弱，常规输血不是首要禁忌项。',
      attention: '长期反复输血患者仍建议筛查，降低弱抗体风险。',
    },
  ],
}

const catGuide: SpeciesGuide = {
  key: 'cat',
  label: '猫',
  subtitle: '猫有强效天然同种抗体，首次异型输血也可能致命。',
  primaryRule: '猫输血首选严格同型，任何一次输血都必须常规交叉配血。',
  typeOptions: ['A型', 'B型', 'AB型'],
  universalNote: 'A 型猫可作为 AB 型应急供血来源；AB 型猫可受 A/B/AB 型血，但仍优先同型。',
  mustDo: [
    '猫首次输血也必须做交叉配血',
    'B 型猫只接受 B 型血，高危手术前需提前备血',
    '输血后至少 30 分钟重点观察黄疸、尿色、呼吸和黏膜颜色',
  ],
  rules: [
    {
      type: 'A型',
      tag: '主流',
      matching: '优先接受 A 型血；急诊可评估少量 AB 型血；禁止接受 B 型血。',
      risk: '输入 B 型血可快速引发急性血管内溶血、黄疸、呼吸衰竭甚至猝死。',
      attention: '临床占比高但不能省略分型，严禁随意输注未分型血液。',
    },
    {
      type: 'B型',
      tag: '稀有高危',
      matching: '仅可接受 B 型同型血液。',
      risk: '体内常有高滴度抗 A 抗体，少量 A 型血即可引发即刻致死性溶血。',
      attention: '英短、波斯、布偶等纯种猫术前建议强制查血型并提前储备血源。',
    },
    {
      type: 'AB型',
      tag: '极稀有',
      matching: '可接受 A、B、AB 型血，仍以同型优先；仅能供给 AB 型猫。',
      risk: '作为供血者给 A 型或 B 型猫会引发受血者溶血风险。',
      attention: '异型输血只作为急诊救命方案，长期反复输血仍需减少异种蛋白暴露。',
    },
  ],
}

export const BLOOD_MATCHING_GUIDE = {
  species: [dogGuide, catGuide],
  commonSafety: [
    '急诊无血型检测条件时，优先做交叉配血，相合后方可输血。',
    '孕犬、孕猫及有繁育计划个体必须严格同型输血，避免新生幼崽溶血病。',
    '该工具用于预约前风险提示，最终输血方案以临床兽医检查和交叉配血结果为准。',
  ],
}

function result(status: CompatibilityStatus, title: string, desc: string) {
  return { status, title, desc }
}

export function getBloodCompatibility(species: SpeciesKey, recipient: string, donor: string) {
  if (species === 'cat') {
    if (recipient === donor) return result('safe', '同型优先', '猫输血首选严格同型，仍需完成交叉配血后再输注。')
    if (recipient === 'A型' && donor === 'AB型') return result('warn', '仅限急诊评估', 'A 型猫可在紧急情况下评估少量 AB 型血，禁止 B 型血。')
    if (recipient === 'AB型') return result('warn', '可兼容但需谨慎', 'AB 型猫可接受 A、B、AB 型血，但异型输血仅建议用于急诊救命。')
    return result('danger', '禁止匹配', '猫存在强效天然同种抗体，首次异型输血也可能致命。')
  }

  if (recipient === donor) return result('safe', '同型优先', '同型输血是犬输血的黄金标准，仍建议结合交叉配血确认。')
  if (donor === 'DEA1.1阴性/DEA7阴性') return result('safe', '通用供血优先', 'DEA1.1 阴性且 DEA7 阴性的犬可作为急诊通用供血来源。')
  if (recipient === 'DEA1.1阴性' && donor === 'DEA1.1阳性') return result('danger', '绝对禁忌', 'DEA1.1 阳性血液禁止输给 DEA1.1 阴性犬，急性溶血风险极高。')
  if (recipient === 'DEA1.1阴性' && donor === 'DEA7阳性') return result('danger', '不建议匹配', 'DEA7 阳性血液不可输给 DEA7 阴性犬，需确认受血犬 DEA7 状态。')
  if (recipient === 'DEA1.1阳性' && donor === 'DEA1.1阴性') return result('warn', '可评估使用', 'DEA1.1 阳性犬可接受阴性血源，但仍需检查 DEA7 等次要血型。')
  return result('warn', '需交叉配血确认', '该组合涉及次要血型或资料不足，预约前请补充分型并做主次侧交叉配血。')
}

