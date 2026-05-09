'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import getApp, { getDb } from '@/lib/cloudbase';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface Review {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productImage: string;
  userId: string;
  userNickname: string;
  rating: number;
  content: string;
  images: string[];
  status: ReviewStatus;
  adminReply: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  async function loadReviews() {
    setLoading(true);
    try {
      let query: any = getDb().collection('product_reviews');
      if (statusFilter !== 'all') query = query.where({ status: statusFilter });
      const { data } = await query.orderBy('createdAt', 'desc').limit(100).get();
      setReviews((data || []).map((d: any) => ({ ...d, id: d._id })));
    } catch (e) {
      console.error('Failed to load reviews:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(reviewId: string, action: 'approveReview' | 'rejectReview') {
    try {
      const { result } = await getApp().callFunction({ name: 'manageReview', data: { action, reviewId } }) as any;
      if (result?.success) {
        loadReviews();
      }
    } catch (e) {
      console.error('Failed:', e);
    }
  }

  async function handleReply() {
    if (!replyReview || !replyText.trim()) return;
    try {
      const { result } = await getApp().callFunction({
        name: 'manageReview',
        data: { action: 'replyReview', reviewId: replyReview.id, reply: replyText },
      }) as any;
      if (result?.success) {
        setReplyReview(null);
        setReplyText('');
        loadReviews();
      }
    } catch (e) {
      console.error('Failed:', e);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
  };

  const counts = {
    all: reviews.length,
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">评论管理</h1>

      <div className="flex gap-2">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm"
            onClick={() => setStatusFilter(s)}>
            {s === 'all' ? '全部' : statusLabels[s]}
          </Button>
        ))}
      </div>

      {loading ? <div>加载中...</div> : (
        <div className="space-y-4">
          {reviews.length === 0 && <div className="text-muted-foreground">暂无评论</div>}
          {reviews.map(review => (
            <Card key={review.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold">{review.productName}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {review.userNickname} · {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[review.status]}`}>
                    {statusLabels[review.status]}
                  </span>
                </div>
                <p className="text-sm">{review.content}</p>
                <div className="text-xs text-muted-foreground">
                  订单 {review.orderId.slice(-8)} · {review.createdAt}
                </div>
                {review.adminReply && (
                  <div className="bg-blue-50 rounded p-2 text-sm">
                    <span className="font-medium">商家回复：</span>{review.adminReply}
                  </div>
                )}
                <div className="flex gap-2">
                  {review.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => handleAction(review.id, 'approveReview')}>通过</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(review.id, 'rejectReview')}>驳回</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setReplyReview(review); setReplyText(review.adminReply || ''); }}>
                    {review.adminReply ? '编辑回复' : '回复'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!replyReview} onOpenChange={() => setReplyReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回复评论</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>回复内容</Label>
            <Input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="输入回复内容" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyReview(null)}>取消</Button>
            <Button onClick={handleReply}>发送</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
