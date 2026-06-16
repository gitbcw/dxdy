# 阿里云短信服务配置指南

> 适用项目：大熊动医华南医学检验实验室（dxdy）
> 适用环境：`cloud1-d7g7ctn4m86bada89`
> 文档用途：指导非技术人员/运营人员完成阿里云短信服务开通与配置，使小程序的「找回密码」「消息订阅」等验证码功能可正常使用。

---

## 一、为什么需要配置这个

小程序以下功能依赖短信验证码：

- **找回密码**：用户通过手机号+短信验证码重置登录密码
- **消息订阅引导页**：未来如开启手机号验证场景，也可能复用该短信能力
- 其他可能用到的验证码场景（注册、修改手机号等）

当前项目代码和云函数 `sendSms`、`resetPassword` 已部署完成，但 `sendSms` 云函数的环境变量为空，验证码发送会失败。**必须配置阿里云短信参数后，功能才能生效。**

---

## 二、阿里云短信服务地址

| 用途 | 链接 |
|---|---|
| 短信服务产品页 | https://www.aliyun.com/product/sms |
| 短信服务控制台 | https://dysms.console.aliyun.com/ |
| 官方新手指南 | https://help.aliyun.com/zh/sms/getting-started/get-started-with-sms |
| 短信签名管理 | https://dysms.console.aliyun.com/domestic/text/sign |
| 短信模板管理 | https://dysms.console.aliyun.com/domestic/text/template |

---

## 三、阿里云侧操作步骤

### 1. 注册/登录阿里云账号

- 访问 https://www.aliyun.com
- 使用公司/团队账号登录，或注册新账号

### 2. 完成实名认证

- 进入「账号中心」→「实名认证」
- **建议企业实名认证**，因为：
  - 个人实名认证的短信签名审核通过率较低
  - 部分短信功能（如推广短信）仅对企业实名开放
  - 企业实名才能开具企业发票

### 3. 开通短信服务

- 访问 https://www.aliyun.com/product/sms
- 点击「立即开通」或「免费开通」
- 勾选服务条款，完成开通

### 4. 申请短信签名

- 进入 https://dysms.console.aliyun.com/domestic/text/sign
- 点击「添加签名」
- 填写信息：
  - **签名类型**：验证码 或 通用
  - **签名名称**：建议使用公司/品牌名，如 `大熊动医`
  - **适用场景**：验证码
  - **资质信息**：上传营业执照等企业资质
- 提交审核，通常 1-2 个工作日内完成

### 5. 申请短信模板

- 进入 https://dysms.console.aliyun.com/domestic/text/template
- 点击「添加模板」
- 填写信息：
  - **模板类型**：验证码
  - **模板名称**：如 `找回密码验证码`
  - **模板内容**：必须包含验证码变量，例如：
    ```
    您的验证码为${code}，5分钟内有效，请勿泄露给他人。
    ```
  - **申请说明**：用于小程序用户找回密码、消息订阅等场景的身份验证
- 提交审核，通常 1-2 个工作日内完成

### 6. 获取 AppCode

本项目使用的是阿里云的「云市场短信 API」（服务商为 `gyytz.market.alicloudapi.com`），需要 AppCode 鉴权。

- 进入阿里云「云市场」https://market.aliyun.com/
- 搜索「短信验证码」或「短信接口」
- 选择一个短信服务商品（确认支持国内验证码短信）
- 购买后进入「已购买的服务」
- 找到对应商品，复制 **AppCode**

> 注意：云市场短信服务通常是预付费或按量计费，购买后即可获得 AppCode。

### 7. 充值/购买套餐

- 短信服务为按量付费，需确保阿里云账户余额充足
- 或进入 https://common-buy.aliyun.com/?commodityCode=newsms 购买短信套餐包
- 国内验证码短信参考价格约 ¥0.045/条，以阿里云官网实时价格为准

---

## 四、项目侧配置步骤

### 1. 打开配置文件

编辑文件：

```
packages/miniprogram/cloudbaserc.json
```

找到 `sendSms` 函数配置：

```json
{
  "name": "sendSms",
  "runtime": "Nodejs18.15",
  "handler": "index.main",
  "timeout": 15,
  "envVariables": {
    "ALIYUN_SMS_APPCODE": "YOUR_APPCODE_HERE",
    "ALIYUN_SMS_SIGN_ID": "YOUR_SIGN_ID_HERE",
    "ALIYUN_SMS_TEMPLATE_ID": "YOUR_TEMPLATE_ID_HERE",
    "ALIYUN_SMS_CODE_SIGN_ID": "YOUR_CODE_SIGN_ID_HERE",
    "ALIYUN_SMS_CODE_TEMPLATE_ID": "YOUR_CODE_TEMPLATE_ID_HERE"
  }
}
```

### 2. 替换占位符

| 环境变量名 | 填写内容 | 从阿里云哪里获取 |
|---|---|---|
| `ALIYUN_SMS_APPCODE` | 云市场购买短信服务后获得的 AppCode | 阿里云云市场 → 已购买的服务 |
| `ALIYUN_SMS_SIGN_ID` | 短信签名 ID | 短信服务控制台 → 签名管理 → SignId |
| `ALIYUN_SMS_TEMPLATE_ID` | 短信模板 ID | 短信服务控制台 → 模板管理 → TemplateId |
| `ALIYUN_SMS_CODE_SIGN_ID` | 验证码签名 ID，可复用上面的签名 ID | 短信服务控制台 → 签名管理 |
| `ALIYUN_SMS_CODE_TEMPLATE_ID` | 验证码模板 ID，可复用上面的模板 ID | 短信服务控制台 → 模板管理 |

示例（假设真实值如下）：

```json
{
  "name": "sendSms",
  "runtime": "Nodejs18.15",
  "handler": "index.main",
  "timeout": 15,
  "envVariables": {
    "ALIYUN_SMS_APPCODE": "APPCODE_abc123def456",
    "ALIYUN_SMS_SIGN_ID": "SMS_123456789",
    "ALIYUN_SMS_TEMPLATE_ID": "SMS_987654321",
    "ALIYUN_SMS_CODE_SIGN_ID": "SMS_123456789",
    "ALIYUN_SMS_CODE_TEMPLATE_ID": "SMS_987654321"
  }
}
```

### 3. 推送到云端

在命令行执行：

```bash
cd packages/miniprogram
npx tcb config update fn sendSms --env-id cloud1-d7g7ctn4m86bada89 --yes
```

执行成功后，`sendSms` 云函数就会使用新的环境变量。

---

## 五、验证是否配置成功

1. 打开小程序登录页
2. 点击「忘记密码」
3. 输入一个已注册的手机号
4. 点击「获取验证码」
5. 如果手机号收到验证码短信，说明配置成功
6. 如果没有收到，检查：
   - 阿里云账户余额是否充足
   - 短信签名和模板是否已审核通过
   - AppCode、SignId、TemplateId 是否填写正确
   - `npx tcb config update fn sendSms` 是否执行成功

---

## 六、费用说明

- 阿里云短信服务是**付费服务**
- 国内验证码短信单价约 **¥0.045/条**（以阿里云实时价格为准）
- 需要提前充值或购买短信套餐包
- 找回密码每使用一次，会消耗一条验证码短信

---

## 七、常见问题

### Q1：能不能用腾讯云短信代替阿里云？

当前 `sendSms` 云函数代码是按阿里云云市场 API 写的。如果要换腾讯云短信，需要修改 `packages/miniprogram/cloudfunctions/sendSms/index.js` 的调用逻辑，并重新部署。

### Q2：个人实名可以吗？

可以，但企业实名的签名审核通过率更高，部分功能也更完整。建议优先使用企业实名。

### Q3：签名审核不通过怎么办？

常见原因：
- 签名名称与资质主体不一致
- 申请说明不清晰
- 使用了非公司/品牌名称作为签名

建议签名名称使用公司简称或品牌名，如 `大熊动医`，并在申请说明中明确用途。

### Q4：配置后多久生效？

执行 `tcb config update` 后通常立即生效。如果短信仍发不出，可进入 CloudBase 控制台 → 云函数 → sendSms → 配置，确认环境变量已正确显示。

---

## 八、相关文件

- 云函数代码：`packages/miniprogram/cloudfunctions/sendSms/index.js`
- 配置文件：`packages/miniprogram/cloudbaserc.json`
- 找回密码页面：`packages/miniprogram/miniprogram/pages/login/forgot-password/`
- 消息订阅页面：`packages/miniprogram/miniprogram/pages/mine/subscribe/`
