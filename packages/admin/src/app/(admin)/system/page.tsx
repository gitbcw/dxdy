'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getSystemConfig, updateSystemConfig } from '@dxdy/shared';
import type { SystemConfig } from '@dxdy/shared';

export default function SystemPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);

  useEffect(() => {
    getSystemConfig().then(setConfig);
  }, []);

  async function handleSave() {
    if (!config) return;
    await updateSystemConfig(config);
    alert('配置已保存');
  }

  if (!config) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统配置</h1>
        <Button onClick={handleSave}>保存配置</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>提成设置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>提成比例 (0-1)</Label>
              <Input type="number" step="0.01" value={config.commissionRate} onChange={e => setConfig({ ...config, commissionRate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>提成锁定天数</Label>
              <Input type="number" value={config.commissionLockDays} onChange={e => setConfig({ ...config, commissionLockDays: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>最低提现金额</Label>
              <Input type="number" value={config.minWithdrawAmount} onChange={e => setConfig({ ...config, minWithdrawAmount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>提现审核开关</Label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={config.withdrawReviewEnabled ? '1' : '0'} onChange={e => setConfig({ ...config, withdrawReviewEnabled: e.target.value === '1' })}>
                <option value="1">开启</option>
                <option value="0">关闭</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>订单设置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>支付超时（分钟）</Label>
              <Input type="number" value={config.paymentTimeoutMinutes} onChange={e => setConfig({ ...config, paymentTimeoutMinutes: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>退换货期限（天）</Label>
              <Input type="number" value={config.returnDeadlineDays} onChange={e => setConfig({ ...config, returnDeadlineDays: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>退换货收货地址</Label>
              <Input value={config.returnAddress} onChange={e => setConfig({ ...config, returnAddress: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>审核超时提醒（小时）</Label>
              <Input type="number" value={config.reviewTimeoutHours} onChange={e => setConfig({ ...config, reviewTimeoutHours: parseInt(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>积分与库存</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>积分获取比例（元:积分）</Label>
              <Input type="number" step="0.1" value={config.pointsRate} onChange={e => setConfig({ ...config, pointsRate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>积分有效期（天，0=永不过期）</Label>
              <Input type="number" value={config.pointsExpiryDays} onChange={e => setConfig({ ...config, pointsExpiryDays: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>库存预警值</Label>
              <Input type="number" value={config.stockWarningThreshold} onChange={e => setConfig({ ...config, stockWarningThreshold: parseInt(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
