import { callFunction } from '@/lib/cloudbase'

export interface CloudFunctionResult {
  success?: boolean
  error?: string
  [key: string]: unknown
}

// ===== Orders =====

export async function adjustOrderPrice(params: {
  orderId: string; newPrice: number; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('adjustOrderPrice', params)
}

export async function assignOrderToClerk(params: {
  orderId: string; clerkId: string; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('assignOrderToClerk', params)
}

export async function clerkShipOrder(params: {
  orderId: string; company: string; trackingNo: string; operatorId: string; operatorName: string
  packageType?: string; coldChainMethod?: string; packageWeight?: string; boxTemperature?: string
  modifyReason?: string; abnormalFlag?: boolean; abnormalType?: string; abnormalReason?: string
}) {
  return callFunction<CloudFunctionResult>('clerkShipOrder', params)
}

export async function updateOrderStatus(params: {
  orderId: string; status: string; operatorId: string; operatorName: string
  bookingAmount?: number; urgentFee?: number
}) {
  return callFunction<CloudFunctionResult>('updateOrderStatus', params)
}

export async function queryOrders(params: {
  action: 'listOrders' | 'getOrderById' | 'getOrderByNo' | 'listClerks'
  operatorId?: string
  orderId?: string
  orderNo?: string
  customerId?: string
  status?: string
}) {
  return callFunction<CloudFunctionResult & { orders?: unknown[]; order?: unknown; clerks?: unknown[] }>('queryOrders', params)
}

// ===== Returns =====

export async function reviewReturn(params: {
  id: string; status?: string; approved?: boolean; note?: string; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('reviewReturn', params)
}

// ===== Finance =====

export async function reviewWithdrawal(params: {
  id: string; status?: string; approved?: boolean; note?: string; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('reviewWithdrawal', params)
}

export async function processInvoice(params: {
  id: string; status: string; note?: string; invoiceFileID?: string; invoiceNo?: string; company?: string; trackingNo?: string; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('processInvoice', params)
}

// ===== Users =====

export async function reviewVerification(params: {
  userId: string; approved: boolean; rejectReason: string; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('reviewVerification', params)
}

export async function reviewAgentApplication(params: {
  userId: string; approved: boolean; rejectReason: string; operatorId: string; operatorName: string
}) {
  return callFunction<CloudFunctionResult>('reviewAgentApplication', params)
}

// ===== Coupons =====

export async function manageCoupon(params: Record<string, unknown> & {
  action: 'createTemplate' | 'updateTemplate' | 'grantCoupon' | 'batchGrantCoupon' | 'disableUserCoupon'
}) {
  return callFunction<CloudFunctionResult>('manageCoupon', params)
}

// ===== Products =====

export async function manageProduct(params: Record<string, unknown> & {
  action: 'deleteProduct' | 'updateProductStatus'
  productId: string
  status?: 'on_sale' | 'off_sale'
  operatorId: string
  operatorName?: string
}) {
  return callFunction<CloudFunctionResult>('manageProduct', params)
}

// ===== Test Reports =====

export async function manageTestReport(params: Record<string, unknown> & {
  action: 'createReport' | 'updateReport' | 'deleteReport'
}) {
  return callFunction<CloudFunctionResult>('manageTestReport', params)
}
