'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { TopProduct } from '@/lib/types-analytics'

interface TopProductsChartProps {
  data: TopProduct[]
}

function truncateName(name: string, maxLen = 10): string {
  if (!name) return ''
  return name.length > maxLen ? name.slice(0, maxLen) + '...' : name
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>热销商品 TOP10</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <p className="text-muted-foreground">暂无数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = [...data].reverse().map((p) => ({
    name: truncateName(p.productName),
    fullName: p.productName,
    revenue: p.revenue,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>热销商品 TOP10</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(v: number) => `¥${v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                width={100}
              />
              <Tooltip
                formatter={(value) => [`¥${formatMoney(Number(value))}`, '营收']}
                labelFormatter={(_label, payload) => {
                  const item = payload as unknown as { payload?: { fullName?: string } }[] | undefined
                  if (item && item[0]?.payload?.fullName) {
                    return item[0].payload.fullName
                  }
                  return String(_label)
                }}
              />
              <Bar dataKey="revenue" fill="#0f766e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
