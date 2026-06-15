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

type BloodBookingPriceRule = {
  species: 'dog' | 'cat';
  bloodType: string;
  volumeMl: number;
  price?: number;
  storePrice: number;
  retailPrice: number;
};
type BloodBookingConfigForm = {
  dogBloodTypes: string[];
  catBloodTypes: string[];
  dogVolumeOptions: number[];
  catVolumeOptions: number[];
  volumeOptions?: number[];
  priceRules: BloodBookingPriceRule[];
};

function parseMoneyInput(value: string) {
  const amount = parseFloat(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

const defaultBloodBookingConfig = {
  dogBloodTypes: ['DEA1.1阳性', 'DEA1.1阴性', 'DEA1.1阴性 + DEA7阴性', 'DEA7阴性', '未检测，需协助配血'],
  catBloodTypes: ['A型', 'B型', 'AB型', '未检测，需协助配血'],
  dogVolumeOptions: [100, 200, 300, 400, 500],
  catVolumeOptions: [50, 100, 150, 200],
  priceRules: [] as BloodBookingPriceRule[],
};

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseVolumeOptions(value: string) {
  const seen = new Set<number>();
  return value
    .split(/[\s,，、\r\n]+/)
    .map(item => Math.round(Number(item)))
    .filter(item => Number.isFinite(item) && item > 0)
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function getBookingPrice(
  config: BloodBookingConfigForm,
  species: 'dog' | 'cat',
  bloodType: string,
  volumeMl: number
) {
  const rule = config.priceRules.find(item => (
    item.species === species &&
    item.bloodType === bloodType &&
    Number(item.volumeMl) === Number(volumeMl)
  ));
  if (!rule) return { storePrice: 0, retailPrice: 0 };
  const legacyPrice = Number(rule.price || 0);
  const storePrice = Number(rule.storePrice || legacyPrice || 0);
  const retailPrice = Number(rule.retailPrice || (storePrice > 0 ? storePrice * 2 : 0));
  return {
    storePrice: Math.round(storePrice * 100) / 100,
    retailPrice: Math.round(retailPrice * 100) / 100,
  };
}

function setBookingPrice(
  config: BloodBookingConfigForm,
  species: 'dog' | 'cat',
  bloodType: string,
  volumeMl: number,
  field: 'storePrice' | 'retailPrice',
  price: number
) {
  const current = getBookingPrice(config, species, bloodType, volumeMl);
  const nextRule = {
    species,
    bloodType,
    volumeMl,
    ...current,
    [field]: price,
  };
  const priceRules = config.priceRules.filter(rule => !(
    rule.species === species &&
    rule.bloodType === bloodType &&
    Number(rule.volumeMl) === Number(volumeMl)
  ));
  if (nextRule.storePrice > 0 || nextRule.retailPrice > 0) priceRules.push(nextRule);
  return { ...config, priceRules };
}

function buildBookingPriceRules(config: BloodBookingConfigForm) {
  const rules: BloodBookingPriceRule[] = [];
  for (const species of ['dog', 'cat'] as const) {
    const bloodTypes = species === 'dog' ? config.dogBloodTypes : config.catBloodTypes;
    const volumes = species === 'dog' ? config.dogVolumeOptions : config.catVolumeOptions;
    for (const bloodType of bloodTypes) {
      for (const volumeMl of volumes) {
        rules.push({
          species,
          bloodType,
          volumeMl,
          ...getBookingPrice(config, species, bloodType, volumeMl),
        });
      }
    }
  }
  return rules;
}

function PriceMatrix({
  title,
  species,
  bloodTypes,
  volumes,
  config,
  onChange,
}: {
  title: string;
  species: 'dog' | 'cat';
  bloodTypes: string[];
  volumes: number[];
  config: BloodBookingConfigForm;
  onChange: (nextConfig: BloodBookingConfigForm) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">每个血型和血量组合都需要配置门店价和零售价。医院客户看门店价，个人客户扫码预约看零售价。</p>
      </div>
      <div className="space-y-3">
        {bloodTypes.map(bloodType => (
          <div key={`${species}-${bloodType}`} className="space-y-2 rounded-md bg-muted/30 p-3">
            <p className="text-sm font-medium">{bloodType}</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {volumes.map(volumeMl => (
                <div key={`${bloodType}-${volumeMl}`} className="space-y-2">
                  <Label className="text-xs">{volumeMl} ml</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={getBookingPrice(config, species, bloodType, volumeMl).storePrice || ''}
                      onChange={event => onChange(setBookingPrice(
                        config,
                        species,
                        bloodType,
                        volumeMl,
                        'storePrice',
                        parseMoneyInput(event.target.value)
                      ))}
                      placeholder="门店价"
                    />
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={getBookingPrice(config, species, bloodType, volumeMl).retailPrice || ''}
                      onChange={event => onChange(setBookingPrice(
                        config,
                        species,
                        bloodType,
                        volumeMl,
                        'retailPrice',
                        parseMoneyInput(event.target.value)
                      ))}
                      placeholder="零售价"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    const legacyVolumeOptions = config.bloodBookingConfig?.volumeOptions || [];
    const bloodBookingConfig: BloodBookingConfigForm = {
      ...defaultBloodBookingConfig,
      ...(config.bloodBookingConfig || {}),
      dogBloodTypes: (config.bloodBookingConfig?.dogBloodTypes || []).filter(Boolean),
      catBloodTypes: (config.bloodBookingConfig?.catBloodTypes || []).filter(Boolean),
      dogVolumeOptions: (config.bloodBookingConfig?.dogVolumeOptions || legacyVolumeOptions).filter(value => Number.isFinite(value) && value > 0),
      catVolumeOptions: (config.bloodBookingConfig?.catVolumeOptions || legacyVolumeOptions).filter(value => Number.isFinite(value) && value > 0),
      priceRules: config.bloodBookingConfig?.priceRules || [],
    };
    const savedBloodBookingConfig = {
      dogBloodTypes: bloodBookingConfig.dogBloodTypes,
      catBloodTypes: bloodBookingConfig.catBloodTypes,
      dogVolumeOptions: bloodBookingConfig.dogVolumeOptions,
      catVolumeOptions: bloodBookingConfig.catVolumeOptions,
      priceRules: buildBookingPriceRules(bloodBookingConfig),
    };
    if (
      savedBloodBookingConfig.dogBloodTypes.length === 0 ||
      savedBloodBookingConfig.catBloodTypes.length === 0 ||
      savedBloodBookingConfig.dogVolumeOptions.length === 0 ||
      savedBloodBookingConfig.catVolumeOptions.length === 0
    ) {
      setError('请至少配置 1 个犬血型、1 个猫血型、1 个犬血血量和 1 个猫血血量');
      return;
    }
    if (savedBloodBookingConfig.priceRules.some(rule => (
      !Number.isFinite(rule.storePrice) ||
      !Number.isFinite(rule.retailPrice) ||
      rule.storePrice <= 0 ||
      rule.retailPrice <= 0
    ))) {
      setError('请为每个犬/猫血型和血量组合配置有效门店价和零售价');
      return;
    }
    if (savedBloodBookingConfig.priceRules.some(rule => rule.retailPrice <= rule.storePrice)) {
      setError('每个用血预约配置的零售价必须高于门店价');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const saved = await saveSystemConfig({ ...config, bloodBookingConfig: savedBloodBookingConfig });
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
  const legacyVolumeOptions = config.bloodBookingConfig?.volumeOptions || [];
  const bloodBookingConfig: BloodBookingConfigForm = {
    ...defaultBloodBookingConfig,
    ...(config.bloodBookingConfig || {}),
    dogVolumeOptions: config.bloodBookingConfig?.dogVolumeOptions || legacyVolumeOptions || defaultBloodBookingConfig.dogVolumeOptions,
    catVolumeOptions: config.bloodBookingConfig?.catVolumeOptions || legacyVolumeOptions || defaultBloodBookingConfig.catVolumeOptions,
    priceRules: config.bloodBookingConfig?.priceRules || [],
  };

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

      <div className="grid items-start gap-6 md:grid-cols-2">
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
              <Label>默认自动收货天数</Label>
              <Input
                type="number"
                min="0"
                value={config.autoReceiptDays ?? 7}
                onChange={e => setConfig({ ...config, autoReceiptDays: parseInt(e.target.value, 10) || 0 })}
              />
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
                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="金额" className="w-24" value={String(tier.amount)} onChange={e => {
                  const tiers = [...(config.rechargeTiers || [])];
                  tiers[i] = { ...tiers[i], amount: parseMoneyInput(e.target.value) };
                  setConfig({ ...config, rechargeTiers: tiers });
                }} />
                <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="赠送" className="w-24" value={String(tier.bonus)} onChange={e => {
                  const tiers = [...(config.rechargeTiers || [])];
                  tiers[i] = { ...tiers[i], bonus: parseMoneyInput(e.target.value) };
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
              <Input type="number" value={config.referralRewardPoints ?? 0} onChange={e => setConfig({ ...config, referralRewardPoints: parseInt(e.target.value) || 0 })} />
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>用血预约配置</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>犬血可预约血型（每行一个）</Label>
              <textarea
                className="min-h-28 w-full rounded-md border px-3 py-2 text-sm"
                value={bloodBookingConfig.dogBloodTypes.join('\n')}
                onChange={e => setConfig({
                  ...config,
                  bloodBookingConfig: {
                    ...bloodBookingConfig,
                    dogBloodTypes: splitLines(e.target.value),
                  },
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>猫血可预约血型（每行一个）</Label>
              <textarea
                className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                value={bloodBookingConfig.catBloodTypes.join('\n')}
                onChange={e => setConfig({
                  ...config,
                  bloodBookingConfig: {
                    ...bloodBookingConfig,
                    catBloodTypes: splitLines(e.target.value),
                  },
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>犬血可预约血量（ml，用逗号、空格或换行分隔）</Label>
              <Input
                value={bloodBookingConfig.dogVolumeOptions.join(', ')}
                onChange={e => setConfig({
                  ...config,
                  bloodBookingConfig: {
                    ...bloodBookingConfig,
                    dogVolumeOptions: parseVolumeOptions(e.target.value),
                  },
                })}
                placeholder="例如：100, 200, 300, 400"
              />
            </div>
            <div className="space-y-2">
              <Label>猫血可预约血量（ml，用逗号、空格或换行分隔）</Label>
              <Input
                value={bloodBookingConfig.catVolumeOptions.join(', ')}
                onChange={e => setConfig({
                  ...config,
                  bloodBookingConfig: {
                    ...bloodBookingConfig,
                    catVolumeOptions: parseVolumeOptions(e.target.value),
                  },
                })}
                placeholder="例如：50, 100, 150, 200"
              />
              <p className="text-xs text-muted-foreground">客户预约时会根据犬血/猫血分别展示对应血量。</p>
            </div>
            <PriceMatrix
              title="犬血价格配置"
              species="dog"
              bloodTypes={bloodBookingConfig.dogBloodTypes}
              volumes={bloodBookingConfig.dogVolumeOptions}
              config={bloodBookingConfig}
              onChange={nextConfig => setConfig({ ...config, bloodBookingConfig: nextConfig })}
            />
            <PriceMatrix
              title="猫血价格配置"
              species="cat"
              bloodTypes={bloodBookingConfig.catBloodTypes}
              volumes={bloodBookingConfig.catVolumeOptions}
              config={bloodBookingConfig}
              onChange={nextConfig => setConfig({ ...config, bloodBookingConfig: nextConfig })}
            />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
