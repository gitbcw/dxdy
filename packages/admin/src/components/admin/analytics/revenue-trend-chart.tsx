'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { AnalyticsDaily } from '@/lib/types-analytics'

interface RevenueTrendChartProps {
  data: AnalyticsDaily[]
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length >= 3) return `${parts[1]}-${parts[2]}`
  return dateStr
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>营收趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <p className="text-muted-foreground">暂无数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = [...data].reverse().map((d) => ({
    date: formatDateLabel(d.date),
    institution: d.byCustomerType?.institution?.revenue || 0,
    personal: d.byCustomerType?.personal?.revenue || 0,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>营收趋势</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#94a3b8"
                tickFormatter={(v: number) => `¥${v >= 10000 ? `${(v / 10000).toFixed(1)}w` : v}`}
              />
              <Tooltip
                formatter={(value, name) => [
                  `¥${formatMoney(Number(value))}`,
                  name === 'institution' ? '机构客户' : '个人客户',
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'institution' ? '机构客户' : '个人客户'
                }
              />
              <Area
                type="monotone"
                dataKey="institution"
                stackId="1"
                stroke="#0f766e"
                fill="#0f766e"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="personal"
                stackId="1"
                stroke="#5eead4"
                fill="#5eead4"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
