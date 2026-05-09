'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { AnalyticsDaily } from '@/lib/types-analytics'

interface RepeatPurchaseMetricsProps {
  data: AnalyticsDaily[]
}

export function RepeatPurchaseMetrics({ data }: RepeatPurchaseMetricsProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>复购与客单价</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height: 100 }}>
            <p className="text-muted-foreground">暂无数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalRepeat = data.reduce((s, d) => s + (d.metrics?.repeatCustomers || 0), 0)
  const totalActive = data.reduce((s, d) => s + (d.metrics?.activeCustomers || 0), 0)
  const totalAvgOrder = data.reduce((s, d) => s + (d.metrics?.avgOrderValue || 0), 0)
  const avgOrderValue = data.length > 0 ? totalAvgOrder / data.length : 0
  const repeatRate = totalActive > 0 ? (totalRepeat / totalActive) * 100 : 0

  const activeCustomers30d = data.slice(0, 30).reduce(
    (s, d) => s + (d.metrics?.activeCustomers || 0),
    0,
  )

  const metrics = [
    {
      label: '复购率',
      value: `${repeatRate.toFixed(1)}%`,
      sublabel: `${totalRepeat} 复购 / ${totalActive} 活跃`,
    },
    {
      label: '平均客单价',
      value: `¥${formatMoney(avgOrderValue)}`,
      sublabel: '所选周期均值',
    },
    {
      label: '30天活跃客户',
      value: activeCustomers30d.toLocaleString(),
      sublabel: '最近30天累计活跃',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>复购与客单价</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-1 rounded-lg border p-4">
              <span className="text-sm text-muted-foreground">{m.label}</span>
              <span className="text-2xl font-semibold text-foreground">{m.value}</span>
              <span className="text-xs text-muted-foreground">{m.sublabel}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
