'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { uploadFileToCloudBase } from '@/lib/upload';
import { writeAdminLog } from '@/lib/admin-log';
import {
  createOfficialArticle,
  deleteOfficialArticle,
  fetchOfficialArticles,
  updateOfficialArticle,
} from '@/lib/services/database';
import type { OfficialArticle, OfficialArticleStatus } from '@/lib/types';

type ArticleFormState = {
  title: string;
  subtitle: string;
  coverUrl: string;
  articleUrl: string;
  tag: string;
  status: OfficialArticleStatus;
  sort: string;
  publishedAt: string;
};

const ARTICLE_IMAGE_PUBLIC_BASE_URL = 'https://636c-cloud1-d7g7ctn4m86bada89-1433980811.tcb.qcloud.la';
const ARTICLE_IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_ARTICLE_IMAGE_SIZE = 2 * 1024 * 1024;

const statusLabel: Record<OfficialArticleStatus, string> = {
  active: '已上架',
  inactive: '已隐藏',
};

const emptyForm = (): ArticleFormState => ({
  title: '',
  subtitle: '',
  coverUrl: '',
  articleUrl: '',
  tag: '猫',
  status: 'active',
  sort: '10',
  publishedAt: new Date().toISOString().slice(0, 10),
});

function getSafeImageFileName(file: File) {
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'cover';
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  return `${name}.${ext}`;
}

async function uploadArticleCover(file: File): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `articles/${timestamp}-${random}-${getSafeImageFileName(file)}`;
  const uploadedPath = await uploadFileToCloudBase(file, cloudPath, {
    allowedTypes: ARTICLE_IMAGE_ALLOWED_TYPES,
    maxSize: MAX_ARTICLE_IMAGE_SIZE,
  });
  return `${ARTICLE_IMAGE_PUBLIC_BASE_URL}/${uploadedPath}`;
}

function toForm(article: OfficialArticle): ArticleFormState {
  return {
    title: article.title || '',
    subtitle: article.subtitle || '',
    coverUrl: article.coverUrl || '',
    articleUrl: article.articleUrl || '',
    tag: article.tag || '猫',
    status: article.status || 'active',
    sort: String(article.sort ?? 10),
    publishedAt: (article.publishedAt || article.createdAt || '').slice(0, 10),
  };
}

function toArticlePayload(form: ArticleFormState) {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    coverUrl: form.coverUrl.trim(),
    articleUrl: form.articleUrl.trim(),
    tag: form.tag.trim(),
    status: form.status,
    sort: parseInt(form.sort, 10) || 0,
    publishedAt: form.publishedAt || new Date().toISOString().slice(0, 10),
  };
}

export default function ArticlesPage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<OfficialArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OfficialArticleStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfficialArticle | null>(null);
  const [form, setForm] = useState<ArticleFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void loadArticles();
  }, []);

  async function loadArticles() {
    setLoading(true);
    setError('');
    try {
      setArticles(await fetchOfficialArticles());
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取文章失败');
    } finally {
      setLoading(false);
    }
  }

  const filteredArticles = useMemo(() => (
    statusFilter === 'all' ? articles : articles.filter(article => article.status === statusFilter)
  ), [articles, statusFilter]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function startEdit(article: OfficialArticle) {
    setEditing(article);
    setForm(toForm(article));
    setDialogOpen(true);
  }

  async function handleCoverUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await uploadArticleCover(file);
      setForm(prev => ({ ...prev, coverUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传封面失败');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const payload = toArticlePayload(form);
    if (!payload.title) { setError('请填写文章标题'); return; }
    if (!payload.coverUrl) { setError('请上传或填写封面图'); return; }
    if (!payload.articleUrl) { setError('请填写公众号文章链接'); return; }

    setSaving(true);
    setError('');
    try {
      if (editing) {
        const updated = await updateOfficialArticle(editing.id, payload);
        setArticles(prev => prev.map(item => (
          item.id === editing.id ? { ...item, ...payload, ...updated } : item
        )));
        await writeAdminLog({ operator: user, action: 'update_article', target: editing.id, detail: `更新文章 ${payload.title}` });
      } else {
        const id = `article_${Date.now().toString(36)}`;
        const created = await createOfficialArticle({ id, ...payload, createdAt: '', updatedAt: '' });
        setArticles(prev => [created, ...prev].sort((a, b) => (a.sort || 0) - (b.sort || 0)));
        await writeAdminLog({ operator: user, action: 'create_article', target: id, detail: `创建文章 ${payload.title}` });
      }
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存文章失败');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(article: OfficialArticle) {
    const nextStatus: OfficialArticleStatus = article.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateOfficialArticle(article.id, { status: nextStatus });
      setArticles(prev => prev.map(item => (
        item.id === article.id ? { ...item, status: nextStatus, updatedAt: updated.updatedAt } : item
      )));
      await writeAdminLog({ operator: user, action: 'update_article_status', target: article.id, detail: `${statusLabel[nextStatus]}文章 ${article.title}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新文章状态失败');
    }
  }

  async function handleDelete(article: OfficialArticle) {
    if (!window.confirm(`确认删除「${article.title}」？`)) return;
    try {
      await deleteOfficialArticle(article.id);
      setArticles(prev => prev.filter(item => item.id !== article.id));
      await writeAdminLog({ operator: user, action: 'delete_article', target: article.id, detail: `删除文章 ${article.title}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除文章失败');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">内容精选</h1>
          <p className="text-sm text-muted-foreground">配置首页好物推荐下方的宠物医疗案例、科普知识和公众号内容推荐。</p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          新增文章
        </Button>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')}>全部</Button>
            <Button size="sm" variant={statusFilter === 'active' ? 'default' : 'outline'} onClick={() => setStatusFilter('active')}>已上架</Button>
            <Button size="sm" variant={statusFilter === 'inactive' ? 'default' : 'outline'} onClick={() => setStatusFilter('inactive')}>已隐藏</Button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章</TableHead>
                  <TableHead>标签</TableHead>
                  <TableHead>排序</TableHead>
                  <TableHead>点击量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>发布日期</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">暂无文章</TableCell>
                  </TableRow>
                )}
                {filteredArticles.map(article => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <div className="flex min-w-[260px] items-center gap-3">
                        <img src={article.coverUrl} alt="" className="h-14 w-20 rounded-md object-cover ring-1 ring-border" />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{article.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{article.subtitle || article.articleUrl}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{article.tag || '-'}</TableCell>
                    <TableCell>{article.sort}</TableCell>
                    <TableCell>{article.clickCount ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={article.status === 'active' ? 'default' : 'secondary'}>{statusLabel[article.status]}</Badge>
                    </TableCell>
                    <TableCell>{article.publishedAt || '-'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="icon-sm" variant="ghost" title="打开链接" onClick={() => window.open(article.articleUrl, '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(article)}>
                          {article.status === 'active' ? '隐藏' : '上架'}
                        </Button>
                        <Button size="icon-sm" variant="outline" title="编辑" onClick={() => startEdit(article)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon-sm" variant="outline" title="删除" onClick={() => handleDelete(article)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑文章' : '新增文章'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              <div className="aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                {form.coverUrl ? (
                  <img src={form.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <ImagePlus className="h-8 w-8" />
                    封面预览
                  </div>
                )}
              </div>
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={event => {
                  void handleCoverUpload(event.target.files);
                  event.target.value = '';
                }}
              />
              <Input
                value={form.coverUrl}
                onChange={event => setForm(prev => ({ ...prev, coverUrl: event.target.value }))}
                placeholder="或直接粘贴封面图片 URL"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>文章标题</Label>
                <Input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="例如：五个字说完猫的所有颜色？" />
              </div>
              <div className="space-y-2">
                <Label>摘要</Label>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.subtitle}
                  onChange={event => setForm(prev => ({ ...prev, subtitle: event.target.value }))}
                  placeholder="展示在首页卡片上的一句简介"
                />
              </div>
              <div className="space-y-2">
                <Label>公众号文章链接</Label>
                <Input value={form.articleUrl} onChange={event => setForm(prev => ({ ...prev, articleUrl: event.target.value }))} placeholder="https://mp.weixin.qq.com/s/..." />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>标签</Label>
                  <Input value={form.tag} onChange={event => setForm(prev => ({ ...prev, tag: event.target.value }))} placeholder="猫" />
                </div>
                <div className="space-y-2">
                  <Label>排序</Label>
                  <Input type="number" value={form.sort} onChange={event => setForm(prev => ({ ...prev, sort: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select value={form.status} onValueChange={value => setForm(prev => ({ ...prev, status: value as OfficialArticleStatus }))}>
                    <SelectTrigger><SelectValue>{statusLabel[form.status]}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">已上架</SelectItem>
                      <SelectItem value="inactive">已隐藏</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>发布日期</Label>
                <Input type="date" value={form.publishedAt} onChange={event => setForm(prev => ({ ...prev, publishedAt: event.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
