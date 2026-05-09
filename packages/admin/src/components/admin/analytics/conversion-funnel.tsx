'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import type { FunnelStep } from '@/lib/types-analytics'

interface ConversionFunnelProps {
  data: FunnelStep[]
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>转化漏斗</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <p className="text-muted-foreground">暂无数据</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxCount = data[0]?.count || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>转化漏斗</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {data.map((step, index) => {
            const widthPercent = Math.max((step.count / maxCount) * 100, 8)
            const dropOffRate = index > 0 ? (1 - step.rate) * 100 : 0

            return (
              <div key={step.label}>
                <div className="flex items-center gap-3">
                  <div className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                    {step.label}
                  </div>
                  <div className="flex-1">
                    <div
                      className="flex items-center justify-between rounded-md px-4 py-2 text-sm text-white"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor:
                          index === 0
                            ? '#0f766e'
                            : index === data.length - 1
                              ? '#5eead4'
                              : `rgb(15 118 110 / ${0.5 + 0.5 * (1 - index / data.length)})`,
                        minWidth: 80,
                      }}
                    >
                      <span>{step.count.toLocaleString()}</span>
                      {index > 0 && (
                        <span className="text-xs opacity-80">
                          {(step.rate * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {index < data.length - 1 && dropOffRate > 0 && (
                  <div className="ml-20 mt-1 mb-1 text-xs text-muted-foreground">
                    ↓ {dropOffRate.toFixed(1)}% 流失
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
