import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import type { Product } from '@/lib/types';

export const runtime = 'nodejs';

type CloudDoc = Record<string, unknown> & {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ToolListResponse = {
  data?: CloudDoc[];
};

function normalizeDoc(doc: CloudDoc): CloudDoc & { id?: string } {
  const { _id, _openid: ignoredOpenid, ...rest } = doc;
  void ignoredOpenid;
  return { id: _id, ...rest };
}

function sortByRecent(a: CloudDoc, b: CloudDoc) {
  return String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || ''));
}

async function readCollection(collectionName: string) {
  const response = await callCloudBaseTool<ToolListResponse | CloudDoc[]>('readNoSqlDatabaseContent', {
    collectionName,
    limit: 500,
  });
  const records = !Array.isArray(response) && Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  return records.map(normalizeDoc).sort(sortByRecent);
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request, { roles: ['product_manager', 'system_admin'] });
  if (response) return response;
  try {
    const [products, categories] = await Promise.all([
      readCollection('products'),
      readCollection('categories'),
    ]);
    return NextResponse.json({ products, categories });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取商品数据失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['product_manager', 'system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as {
      product?: Product;
      operatorId?: string;
      operatorName?: string;
      operatorRole?: string;
    };
    if (!body.product?.id) return NextResponse.json({ error: '商品参数缺失' }, { status: 400 });

    const now = new Date().toISOString();
    const product = {
      ...body.product,
      createdAt: body.product.createdAt || now,
      updatedAt: now,
    };

    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'insert',
      collectionName: 'products',
      documents: [{ _id: product.id, ...product }],
    });
    await writeAdminLog({
      operator: user,
      action: '商品创建',
      target: product.id,
      detail: `创建商品「${product.name}」，库存 ${product.stock}`,
    });
    return NextResponse.json({ product });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建商品失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['product_manager', 'system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as {
      id?: string;
      updates?: Partial<Product>;
      operatorId?: string;
      operatorName?: string;
      operatorRole?: string;
    };
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: '商品参数缺失' }, { status: 400 });
    if (!body.updates || Object.keys(body.updates).length === 0) {
      return NextResponse.json({ error: '商品更新内容缺失' }, { status: 400 });
    }

    const update = { ...body.updates, updatedAt: new Date().toISOString() };
    await callCloudBaseTool('writeNoSqlDatabaseContent', {
      action: 'update',
      collectionName: 'products',
      query: { _id: id },
      update: { $set: update },
    });

    const products = await readCollection('products');
    const product = products.find(item => item.id === id) || { id, ...update };
    const updateKeys = Object.keys(body.updates).join('、');
    await writeAdminLog({
      operator: user,
      action: body.updates.status === 'on_sale' ? '商品上架' : body.updates.status === 'off_sale' ? '商品下架' : '商品更新',
      target: id,
      detail: `商品「${String(product.name || id)}」更新：${updateKeys}`,
    });

    return NextResponse.json({ product });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '更新商品失败' }, { status: 500 });
  }
}
