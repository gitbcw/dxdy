'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { AgentContribution } from '@/lib/types-analytics'

interface AgentContributionChartProps {
  data: AgentContribution[]
}

export function AgentContributionChart({ data }: AgentContributionChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>代理商贡献</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <p className="text-muted-foreground">暂无数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = [...data].reverse().map((a) => ({
    name: a.salespersonName,
    revenue: a.revenue,
    commission: a.commission,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>代理商贡献</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
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
                width={80}
              />
              <Tooltip
                formatter={(value, name) => [
                  `¥${formatMoney(Number(value))}`,
                  name === 'revenue' ? '营收' : '佣金',
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'revenue' ? '营收' : '佣金'
                }
              />
              <Bar dataKey="revenue" stackId="a" fill="#0f766e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="commission" stackId="a" fill="#5eead4" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
