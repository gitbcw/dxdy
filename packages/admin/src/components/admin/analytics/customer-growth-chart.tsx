'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { AnalyticsDaily } from '@/lib/types-analytics'

interface CustomerGrowthChartProps {
  data: AnalyticsDaily[]
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length >= 3) return `${parts[1]}-${parts[2]}`
  return dateStr
}

export function CustomerGrowthChart({ data }: CustomerGrowthChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>客户增长</CardTitle>
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
    newCustomers: d.metrics?.newCustomers || 0,
    activeCustomers: d.metrics?.activeCustomers || 0,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>客户增长</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend
                formatter={(value: string) => {
                  if (value === 'newCustomers') return '新增客户'
                  if (value === 'activeCustomers') return '活跃客户'
                  return value
                }}
              />
              <Bar dataKey="newCustomers" fill="#0f766e" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="activeCustomers"
                stroke="#5eead4"
                strokeWidth={2}
                dot={{ fill: '#5eead4', r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
