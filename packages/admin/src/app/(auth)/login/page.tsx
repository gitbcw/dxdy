'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { adminLogin } from '@dxdy/shared';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await adminLogin(username, password);
    setLoading(false);
    if (result.success && result.user) {
      localStorage.setItem('admin_user', JSON.stringify(result.user));
      const landingPath =
        result.user.role === 'system_admin'
          ? '/dashboard'
          : result.user.role === 'product_manager'
            ? '/products'
            : '/orders';
      router.push(landingPath);
    } else {
      setError(result.error ?? '登录失败');
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">大熊动医华南医学检验实验室管理后台</CardTitle>
        <CardDescription>请输入账号密码登录</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">账号</Label>
            <Input
              id="username"
              placeholder="输入用户名"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            测试账号：service / product_manager / system_admin（密码任意）
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
