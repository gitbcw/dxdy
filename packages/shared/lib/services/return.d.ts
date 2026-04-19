import type { ReturnRecord, ReturnStatus } from '../types/system';
/** 获取退换货列表 */
export declare function getReturns(options?: {
    orderId?: string;
    status?: ReturnStatus;
}): Promise<ReturnRecord[]>;
/** 获取退换货详情 */
export declare function getReturnById(id: string): Promise<ReturnRecord | null>;
/** 创建退换货申请 */
export declare function createReturn(data: {
    orderId: string;
    type: 'return' | 'exchange';
    reason: string;
    items: {
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
    }[];
    exchangeItem?: ReturnRecord['exchangeItem'];
}): Promise<ReturnRecord>;
/** 审核退换货 */
export declare function reviewReturn(id: string, approved: boolean, reviewerId: string, note: string): Promise<ReturnRecord | null>;
/** 更新退换货状态 */
export declare function updateReturnStatus(id: string, status: ReturnStatus): Promise<ReturnRecord | null>;
/** 提交退货物流信息并更新状态 */
export declare function submitReturnLogistics(id: string, company: string, trackingNo: string): Promise<ReturnRecord | null>;
/** 获取全部退换货（后台用） */
export declare function getAllReturns(): Promise<ReturnRecord[]>;
//# sourceMappingURL=return.d.ts.map