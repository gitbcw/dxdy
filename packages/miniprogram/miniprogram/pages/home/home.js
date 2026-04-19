"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { getProducts, getOrders, getReturns, getClerkOrders, getSalesmanCustomers, getCommissionSummary, formatMoney, } = require('../../services/index');
Page({
    data: {
        roleLabel: '个人客户',
        pageTitle: '今天先看看要买什么',
        heroSubtitle: '围绕宠物医院采购、宠物用血预约和订单履约，提供稳定的日常采购协同。',
        primaryActionText: '进入宠物药品采购',
        secondaryActionText: '查看订单进度',
        avatarText: '客',
        displayName: '未登录客户',
        identityDesc: '按客户身份展示可采购商品、价格与订单能力',
        verificationText: '个人客户',
        verificationClass: 'neutral',
        summaryCards: [],
        taskCards: [],
        quickActions: [],
        boardTitle: '推荐采购',
        boardMoreText: '全部商品',
        boardItems: [],
        currentRole: 'customer_personal',
    },
    onShow() {
        this.loadDemoHome();
    },
    async loadDemoHome() {
        const app = getApp();
        const user = app.globalData.userInfo;
        const currentRole = (app.globalData.userRole || this.inferRole(user));
        const isInstitution = currentRole === 'customer_institution' || user?.customerType === 'institution';
        const visibility = isInstitution ? 'institution' : 'personal';
        const [products, customerOrders, allReturns, clerkPending, clerkShipped, customers, commission] = await Promise.all([
            getProducts({ visibility }),
            user?.role === 'customer' ? getOrders({ customerId: user.id }) : Promise.resolve([]),
            getReturns(),
            getClerkOrders ? getClerkOrders({ status: 'pending' }) : Promise.resolve([]),
            getClerkOrders ? getClerkOrders({ status: 'shipped' }) : Promise.resolve([]),
            getSalesmanCustomers ? getSalesmanCustomers() : Promise.resolve([]),
            getCommissionSummary ? getCommissionSummary() : Promise.resolve(null),
        ]);
        const pendingOrders = customerOrders.filter((order) => !['completed', 'cancelled'].includes(order.status));
        const identity = this.getIdentityCopy(currentRole, user);
        const dashboard = this.getDashboard(currentRole, {
            user,
            products,
            customerOrders,
            pendingOrders,
            allReturns,
            clerkPending,
            clerkShipped,
            customers,
            commission,
        });
        this.setData({
            currentRole,
            ...identity,
            ...dashboard,
        });
    },
    inferRole(user) {
        if (user?.role === 'salesperson')
            return 'salesperson';
        if (user?.role === 'clerk')
            return 'clerk';
        if (user?.customerType === 'institution')
            return 'customer_institution';
        return 'customer_personal';
    },
    getIdentityCopy(role, user) {
        const name = user?.nickname || '未登录客户';
        if (role === 'customer_institution') {
            const status = user?.verificationStatus || 'approved';
            const textMap = {
                approved: '机构认证已通过',
                pending: '机构认证待审核',
                rejected: '认证被驳回',
                none: '待提交机构认证',
            };
            return {
                roleLabel: '宠物医院',
                avatarText: name[0] || '医',
                displayName: name,
                identityDesc: '机构价采购 · 血液制品预约 · 订单进度统一追踪',
                verificationText: textMap[status] || '机构认证已通过',
                verificationClass: status === 'approved' ? 'approved' : 'pending',
            };
        }
        if (role === 'salesperson') {
            return {
                roleLabel: '业务员',
                avatarText: name[0] || '业',
                displayName: name,
                identityDesc: '客户绑定永久有效 · 提成和售后变化自动关联',
                verificationText: '业务员已认证',
                verificationClass: 'approved',
            };
        }
        if (role === 'clerk') {
            return {
                roleLabel: '制单员',
                avatarText: name[0] || '制',
                displayName: name,
                identityDesc: '接单发货 · 录入物流 · 普通单与换货单统一处理',
                verificationText: '任务同步中',
                verificationClass: 'approved',
            };
        }
        return {
            roleLabel: '个人客户',
            avatarText: name[0] || '客',
            displayName: name,
            identityDesc: '保健品零售 · 订单售后统一查看 · 注册即用',
            verificationText: '个人客户',
            verificationClass: 'neutral',
        };
    },
    getDashboard(role, data) {
        if (role === 'customer_institution') {
            const pendingPayment = data.customerOrders.find((order) => order.status === 'pending_payment');
            const shippingOrder = data.customerOrders.find((order) => order.status === 'pending_receipt');
            const returnOrder = data.allReturns.find((record) => record.orderId === shippingOrder?.id || record.status === 'pending_review');
            const bloodProducts = data.products.filter((product) => product.isBloodPack).slice(0, 3);
            const commonProducts = data.products
                .filter((product) => !product.isBloodPack)
                .slice(0, 3)
                .map((product) => ({
                id: product.id,
                badge: product.visibility === 'institution_only' ? '机构价' : '常购',
                title: product.name,
                desc: product.specs?.[0]?.value || '标准规格',
                meta: `¥${formatMoney(product.institutionPrice || product.personalPrice || 0)} · 库存 ${product.stock}`,
                action: 'catalog',
                actionText: '去采购',
            }));
            return {
                pageTitle: '先把采购和预约处理掉',
                heroSubtitle: '今天优先关注待付款订单、血液预约入口和最近常购商品，机构客户能直接完成采购闭环。',
                primaryActionText: '再次采购',
                secondaryActionText: '预约用血',
                summaryCards: [
                    { value: String(data.pendingOrders.length), label: '待处理订单', desc: '优先看待付款和待收货' },
                    { value: String(data.allReturns.filter((record) => record.status !== 'completed').length), label: '售后处理中', desc: '退款、换货统一跟进' },
                    { value: `¥${formatMoney(data.customerOrders.reduce((sum, order) => sum + order.pricing.actualAmount, 0))}`, label: '累计采购', desc: '机构价已生效' },
                ],
                taskCards: [
                    {
                        badge: '优先',
                        title: pendingPayment ? `${pendingPayment.id} 待付款` : '没有待付款订单',
                        desc: pendingPayment ? `${pendingPayment.items.length} 件商品待完成支付` : '可以直接进入机构采购专区下新单',
                        meta: pendingPayment ? `应付 ¥${formatMoney(pendingPayment.pricing.actualAmount)}` : '继续采购常购商品',
                        action: pendingPayment ? 'orders' : 'catalog',
                        actionText: pendingPayment ? '去支付' : '去采购',
                    },
                    {
                        badge: '服务',
                        title: bloodProducts.length ? '宠物用血预约入口已开放' : '血液制品预约入口',
                        desc: bloodProducts.length ? `当前可见 ${bloodProducts.length} 个血液制品，适合直接发起预约。` : '机构认证通过后可查看血液制品和预约服务。',
                        meta: bloodProducts.length ? bloodProducts.map((item) => item.name).join(' · ') : '查看犬猫血液制品',
                        action: 'blood',
                        actionText: '去预约',
                    },
                    {
                        badge: '提醒',
                        title: shippingOrder ? `${shippingOrder.id} 待收货` : '售后与物流进度',
                        desc: returnOrder ? `当前有 1 条售后在跟进：${returnOrder.reason}` : '收货、售后和退款进度都会在订单中心统一展示。',
                        meta: shippingOrder ? '查看物流和售后状态' : '进入订单中心查看',
                        action: 'orders',
                        actionText: '看进度',
                    },
                ],
                quickActions: [
                    { icon: '购', title: '机构采购', desc: '常购和机构价专区', action: 'catalog' },
                    { icon: '血', title: '预约用血', desc: '查看血液制品', action: 'blood' },
                    { icon: '单', title: '我的订单', desc: '查看支付和售后', action: 'orders' },
                    { icon: '址', title: '收货地址', desc: '已有地址可直接选', action: 'address' },
                ],
                boardTitle: '最近常购',
                boardMoreText: '进入采购',
                boardItems: commonProducts,
            };
        }
        if (role === 'salesperson') {
            const recentCustomers = data.customers.slice(0, 3);
            return {
                pageTitle: '先跟进最有机会成交的客户',
                heroSubtitle: '业务员首页要先看到客户机会、佣金变化和需要马上跟进的动作，不再只是介绍规则。',
                primaryActionText: '去跟进客户',
                secondaryActionText: '打开推广码',
                summaryCards: [
                    { value: `¥${formatMoney(data.commission?.available || 0)}`, label: '可提现佣金', desc: '已经可以申请提现' },
                    { value: String(data.customers.length), label: '绑定客户', desc: '机构客户为主' },
                    { value: `¥${formatMoney(data.commission?.pendingDeduction || 0)}`, label: '售后扣减', desc: '售后会自动影响提成' },
                ],
                taskCards: [
                    {
                        badge: '机会',
                        title: recentCustomers[0] ? `${recentCustomers[0].nickname} 可继续跟进` : '先去推广拉新',
                        desc: recentCustomers[0] ? `已绑定 ${recentCustomers[0].orderCount} 笔订单，适合推动复购或服务升级。` : '新客户首次注册后会自动绑定业务员关系。',
                        meta: recentCustomers[0] ? `累计采购 ¥${formatMoney(recentCustomers[0].totalAmount)}` : '推广绑定长期有效',
                        action: recentCustomers[0] ? 'customers' : 'promote',
                        actionText: recentCustomers[0] ? '看客户' : '去推广',
                    },
                    {
                        badge: '收益',
                        title: '佣金状态一眼可见',
                        desc: '提成、可提现金额、售后扣减和锁定状态都会在同一处集中查看。',
                        meta: `累计佣金 ¥${formatMoney(data.commission?.total || 0)}`,
                        action: 'commission',
                        actionText: '看佣金',
                    },
                    {
                        badge: '拉新',
                        title: '推广素材可以直接拿去用',
                        desc: '首页直接放推广入口，比从“我的”页层层点击更顺手。',
                        meta: '二维码、海报、绑定说明',
                        action: 'promote',
                        actionText: '去推广',
                    },
                ],
                quickActions: [
                    { icon: '客', title: '客户管理', desc: '跟进沉默和高潜客户', action: 'customers' },
                    { icon: '佣', title: '我的佣金', desc: '查看可提现和扣减', action: 'commission' },
                    { icon: '推', title: '推广工具', desc: '二维码和海报', action: 'promote' },
                    { icon: '切', title: '切换身份', desc: '查看不同工作台', action: 'switchRole' },
                ],
                boardTitle: '今天最值得跟进',
                boardMoreText: '查看客户',
                boardItems: recentCustomers.map((customer) => ({
                    id: customer.id,
                    badge: customer.type === 'institution' ? '机构客户' : '个人客户',
                    title: customer.nickname,
                    desc: `已下单 ${customer.orderCount} 次，售后 ${customer.exchangeCount} 次`,
                    meta: `累计采购 ¥${formatMoney(customer.totalAmount)}`,
                    action: 'customers',
                    actionText: '去跟进',
                })),
            };
        }
        if (role === 'clerk') {
            const urgentOrders = data.clerkPending.slice(0, 3);
            return {
                pageTitle: '先把今天最急的单发出去',
                heroSubtitle: '制单员首页直接进入待发货队列、换货单和物流录入，不再先讲流程。',
                primaryActionText: '处理待发货',
                secondaryActionText: '查看全部订单',
                summaryCards: [
                    { value: String(data.clerkPending.length), label: '待处理', desc: '普通单和换货单' },
                    { value: String(data.clerkShipped.length), label: '已发货', desc: '今天已处理的任务' },
                    { value: '实时', label: '物流同步', desc: '客户下单页会看到进度' },
                ],
                taskCards: [
                    {
                        badge: '优先',
                        title: urgentOrders[0] ? `${urgentOrders[0].orderNo} 等待发货` : '暂无待发货任务',
                        desc: urgentOrders[0] ? `${urgentOrders[0].customerName} · ${urgentOrders[0].items[0]?.name || '订单商品'}` : '当前没有新的制单待办。',
                        meta: urgentOrders[0] ? `${urgentOrders[0].type === 'exchange' ? '换货单' : '普通单'} · ${urgentOrders[0].address}` : '可以查看历史订单记录',
                        action: 'clerkPending',
                        actionText: '去处理',
                    },
                    {
                        badge: '批量',
                        title: '录入物流是下一步',
                        desc: '录入快递公司和单号后，客户能立即在订单中心看到物流状态。',
                        meta: '支持普通订单与换货订单',
                        action: 'clerkOrders',
                        actionText: '看全部',
                    },
                    {
                        badge: '换货',
                        title: data.clerkPending.some((item) => item.type === 'exchange') ? '换货单需要优先处理' : '暂无换货单',
                        desc: data.clerkPending.some((item) => item.type === 'exchange')
                            ? '换货单会关联原订单，方便客服与客户一起追踪。'
                            : '出现换货申请后会自动生成待发货任务。',
                        meta: '换货链路和普通发货分开展示',
                        action: 'clerkPending',
                        actionText: '看任务',
                    },
                ],
                quickActions: [
                    { icon: '发', title: '待处理订单', desc: '按优先级发货', action: 'clerkPending' },
                    { icon: '运', title: '全部订单', desc: '查看已发货与换货', action: 'clerkOrders' },
                    { icon: '切', title: '切换身份', desc: '查看其他工作台', action: 'switchRole' },
                ],
                boardTitle: '当前发货队列',
                boardMoreText: '全部订单',
                boardItems: urgentOrders.map((order) => ({
                    id: order.id,
                    badge: order.type === 'exchange' ? '换货单' : '普通单',
                    title: order.orderNo,
                    desc: `${order.customerName} · ${order.items[0]?.name || '订单商品'}`,
                    meta: order.address,
                    action: 'clerkPending',
                    actionText: '去发货',
                })),
            };
        }
        const featuredProducts = data.products.slice(0, 3).map((product) => ({
            id: product.id,
            badge: product.isBloodPack ? '服务商品' : '热销',
            title: product.name,
            desc: product.specs?.[0]?.value || '标准规格',
            meta: `¥${formatMoney(product.personalPrice || product.institutionPrice || 0)} · 库存 ${product.stock}`,
            action: 'catalog',
            actionText: '去购买',
        }));
        return {
            pageTitle: '今天先把想买的东西下单',
            heroSubtitle: '个人客户首页更像购物和订单面板，重点放在下单、查看订单和售后进度。',
            primaryActionText: '进入采购',
            secondaryActionText: '查看订单',
            summaryCards: [
                { value: String(data.products.length), label: '可购商品', desc: '面向个人客户开放' },
                { value: String(data.customerOrders.length), label: '我的订单', desc: '支付、发货和售后可查' },
                { value: String(data.allReturns.filter((record) => record.status !== 'completed').length), label: '售后中', desc: '退款和换货进度' },
            ],
            taskCards: [
                {
                    badge: '下单',
                    title: data.pendingOrders[0] ? `${data.pendingOrders[0].id} 正在处理中` : '先去选购常用品',
                    desc: data.pendingOrders[0] ? '可以继续跟进付款、收货和售后进度。' : '首页直接进入商品页，减少说明信息干扰。',
                    meta: data.pendingOrders[0] ? `当前状态：${data.pendingOrders[0].status}` : '宠物保健品与检测服务',
                    action: data.pendingOrders[0] ? 'orders' : 'catalog',
                    actionText: data.pendingOrders[0] ? '看订单' : '去购买',
                },
                {
                    badge: '提醒',
                    title: '订单售后统一看',
                    desc: '退货、换货和退款进度都收拢在订单中心，不需要来回找入口。',
                    meta: '订单中心统一查看',
                    action: 'orders',
                    actionText: '去查看',
                },
                {
                    badge: '地址',
                    title: '收货信息随时可用',
                    desc: '下单时直接选择现有地址，不打断购买流程。',
                    meta: '已有地址在下单页复用',
                    action: 'address',
                    actionText: '看说明',
                },
            ],
            quickActions: [
                { icon: '购', title: '宠物保健', desc: '直接去购买', action: 'catalog' },
                { icon: '单', title: '我的订单', desc: '查看售后进度', action: 'orders' },
                { icon: '址', title: '收货地址', desc: '下单时直接选择', action: 'address' },
                { icon: '切', title: '切换身份', desc: '切换演示角色', action: 'switchRole' },
            ],
            boardTitle: '热销推荐',
            boardMoreText: '查看全部',
            boardItems: featuredProducts,
        };
    },
    handleAction(action) {
        const routes = {
            promote: '/pages/salesman/promote/promote',
            customers: '/pages/salesman/customers/customers',
            commission: '/pages/salesman/commission/commission',
            clerkPending: '/pages/clerk/pending/pending',
            clerkOrders: '/pages/clerk/orders/orders',
            orders: '/pages/orders/order-detail/order-detail?list=1',
        };
        if (action === 'catalog' || action === 'blood') {
            wx.switchTab({ url: '/pages/catalog/catalog' });
            return;
        }
        if (action === 'switchRole') {
            this.onMineTap();
            return;
        }
        if (action === 'address') {
            wx.showToast({ title: '下单时可直接选择已有地址', icon: 'none' });
            return;
        }
        wx.navigateTo({ url: routes[action] || '/pages/orders/order-detail/order-detail?list=1' });
    },
    onPrimaryAction() {
        const role = this.data.currentRole;
        if (role === 'salesperson') {
            this.handleAction('customers');
            return;
        }
        if (role === 'clerk') {
            this.handleAction('clerkPending');
            return;
        }
        this.handleAction('catalog');
    },
    onSecondaryAction() {
        const role = this.data.currentRole;
        if (role === 'customer_institution') {
            this.handleAction('blood');
            return;
        }
        if (role === 'salesperson') {
            this.handleAction('promote');
            return;
        }
        if (role === 'clerk') {
            this.handleAction('clerkOrders');
            return;
        }
        this.handleAction('orders');
    },
    onTaskTap(e) {
        this.handleAction(e.currentTarget.dataset.action);
    },
    onQuickActionTap(e) {
        this.handleAction(e.currentTarget.dataset.action);
    },
    onBoardItemTap(e) {
        this.handleAction(e.currentTarget.dataset.action);
    },
    onBoardMoreTap() {
        const role = this.data.currentRole;
        if (role === 'salesperson') {
            this.handleAction('customers');
            return;
        }
        if (role === 'clerk') {
            this.handleAction('clerkOrders');
            return;
        }
        this.handleAction('catalog');
    },
    onMineTap() {
        wx.switchTab({ url: '/pages/mine/mine' });
    },
});
