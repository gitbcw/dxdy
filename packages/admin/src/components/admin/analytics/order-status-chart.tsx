'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatMoney } from '@/lib/format'
import type { OrderStatusDistribution } from '@/lib/types-analytics'

interface OrderStatusChartProps {
  data: OrderStatusDistribution[]
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#f59e0b',
  pending_shipment: '#3b82f6',
  pending_receipt: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
  pending_confirmation: '#06b6d4',
  in_service: '#6366f1',
}

const DEFAULT_COLOR = '#94a3b8'

function getColor(status: string): string {
  return STATUS_COLORS[status] || DEFAULT_COLOR
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function OrderStatusChart({ data }: OrderStatusChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>订单状态分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <p className="text-muted-foreground">暂无数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>订单状态分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={renderCustomLabel}
              >
                {data.map((entry) => (
                  <Cell key={entry.status} fill={getColor(entry.status)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, props) => {
                  const payload = (props as { payload?: OrderStatusDistribution }).payload
                  return [
                    `${value} 笔 / ¥${formatMoney(payload?.amount || 0)}`,
                    payload?.label || '',
                  ]
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
