'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { fetchSystemConfig, saveSystemConfig } from '@/lib/services/database';
import { writeAdminLog } from '@/lib/admin-log';
import type { SystemConfig } from '@/lib/types';

export default function SystemPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadConfig() {
      setError('');
      try {
        const data = await fetchSystemConfig();
        setConfig(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取系统配置失败');
      }
    }

    loadConfig();
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await saveSystemConfig(config);
      await writeAdminLog({ operator: user, action: 'save_system_config', target: 'system', detail: '保存系统配置' });
      setConfig(saved);
      setMessage('配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存系统配置失败');
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统配置</h1>
        <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存配置'}</Button>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

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
        <Card>
          <CardHeader><CardTitle>充值档位配置</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(config.rechargeTiers || []).map((tier, i) => (
              <div key={i} className="flex items-center gap-3">
                <Input type="number" placeholder="金额" className="w-24" value={String(tier.amount)} onChange={e => {
                  const tiers = [...(config.rechargeTiers || [])];
                  tiers[i] = { ...tiers[i], amount: parseFloat(e.target.value) || 0 };
                  setConfig({ ...config, rechargeTiers: tiers });
                }} />
                <Input type="number" placeholder="赠送" className="w-24" value={String(tier.bonus)} onChange={e => {
                  const tiers = [...(config.rechargeTiers || [])];
                  tiers[i] = { ...tiers[i], bonus: parseFloat(e.target.value) || 0 };
                  setConfig({ ...config, rechargeTiers: tiers });
                }} />
                <Input placeholder="标签（可选）" className="flex-1" value={tier.label || ''} onChange={e => {
                  const tiers = [...(config.rechargeTiers || [])];
                  tiers[i] = { ...tiers[i], label: e.target.value };
                  setConfig({ ...config, rechargeTiers: tiers });
                }} />
                <Button variant="outline" size="sm" onClick={() => {
                  const tiers = (config.rechargeTiers || []).filter((_, j) => j !== i);
                  setConfig({ ...config, rechargeTiers: tiers });
                }}>删除</Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => {
              setConfig({ ...config, rechargeTiers: [...(config.rechargeTiers || []), { amount: 0, bonus: 0, label: '' }] });
            }}>添加档位</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>推荐奖励</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>推荐奖励积分（被推荐人首单完成后奖励给推荐人）</Label>
              <Input type="number" value={config.referralRewardPoints} onChange={e => setConfig({ ...config, referralRewardPoints: parseInt(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
