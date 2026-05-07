import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { callCloudBaseTool } from '@/lib/cloudbase-mcp';
import { unwrapCloudFunctionResult } from '@/lib/cloudbase-function-result';

export const runtime = 'nodejs';

const functionMap: Record<string, string> = {
  verification: 'reviewVerification',
  agent: 'reviewAgentApplication',
};

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request, { roles: ['system_admin'] });
  if (response) return response;
  try {
    const body = await request.json() as {
      type?: string;
      userId?: string;
      approved?: boolean;
      rejectReason?: string;
      operatorId?: string;
      operatorName?: string;
    };
    const type = String(body.type || '');
    const functionName = functionMap[type];
    if (!functionName) {
      return NextResponse.json({ error: '审核类型无效' }, { status: 400 });
    }
    if (!body.userId || typeof body.approved !== 'boolean') {
      return NextResponse.json({ error: '审核参数缺失' }, { status: 400 });
    }
    if (!body.approved && !String(body.rejectReason || '').trim()) {
      return NextResponse.json({ error: '请填写驳回原因' }, { status: 400 });
    }

    const response = await callCloudBaseTool<{
      data?: { success?: boolean; error?: string };
      result?: { success?: boolean; error?: string };
      success?: boolean;
      error?: string;
    }>('manageFunctions', {
      action: 'invokeFunction',
      functionName,
      params: {
        userId: body.userId,
        approved: body.approved,
        rejectReason: String(body.rejectReason || '').trim(),
        operatorId: String(body.operatorId || user?.id || ''),
        operatorName: String(body.operatorName || user?.realName || user?.username || ''),
      },
    });
    const result = unwrapCloudFunctionResult(response);
    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || '审核失败' }, { status: 400 });
    }
    await writeAdminLog({
      operator: user,
      action: type === 'verification' ? '机构审核' : '推广员审核',
      target: body.userId,
      detail: `${body.approved ? '通过' : '驳回'}${type === 'verification' ? '机构认证' : '推广员申请'}「${body.userId}」${body.rejectReason ? `，原因：${body.rejectReason}` : ''}`,
    });
    return NextResponse.json(result || { success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '审核失败' }, { status: 500 });
  }
}
