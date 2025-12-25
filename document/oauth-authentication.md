# OAuth Authentication Flow Documentation

## 概述 (Overview)

UltraForce Chrome 扩展使用 Salesforce Implicit OAuth 2.0 流程进行用户认证，支持生产环境和沙盒环境。

## 认证架构 (Authentication Architecture)

### 核心组件 (Core Components)

1. **AuthManager** (`/src/lib/auth.ts`)
   - 单例模式的认证管理器
   - 负责OAuth流程、token管理和存储
   - 支持自动token刷新和过期处理

2. **SecureStorage** (`/src/lib/auth.ts`)
   - XOR加密的安全存储层
   - 存储敏感认证数据到Chrome本地存储
   - 支持数据加密/解密和密钥管理

3. **Background Script** (`/src/background/index.ts`)
   - 监听OAuth回调URL
   - 处理跨tab通信
   - 管理扩展生命周期

4. **Content Script** (`/src/contents/salesforce-search*.tsx`)
   - 用户界面交互
   - 启动OAuth流程
   - 处理认证状态更新

## OAuth 流程详解 (OAuth Flow Details)

### 1. 初始化认证 (Authentication Initialization)

```typescript
// 扩展启动时自动初始化
await initializeAuth()

// 检查已认证的组织
const authenticatedOrgs = getAuthenticatedOrgs()
```

### 2. 启动OAuth流程 (Initiate OAuth Flow)

```typescript
// 用户选择环境类型
const isSandbox = confirm('Choose environment')

// 启动Implicit OAuth流程
const organization = await auth.initiateOAuthFlow(isSandbox)
```

#### OAuth URL构建
- **生产环境**: `https://login.salesforce.com/services/oauth2/authorize`
- **沙盒环境**: `https://test.salesforce.com/services/oauth2/authorize`
- **重定向URI**: 使用Salesforce默认success页面

### 3. OAuth回调处理 (OAuth Callback Handling)

#### 3.1 Background Script监听
```typescript
// 监听success页面
if (url.includes('/services/oauth2/success') && url.includes('#')) {
  // 发送成功消息到content script
  chrome.tabs.sendMessage(sourceTabId, {
    action: 'OAUTH_SUCCESS',
    url: url,
    state: oauthState
  })
}
```

#### 3.2 Content Script处理
```typescript
// 清理重复监听器
this.cleanupMessageListener()

// 处理OAuth成功回调
this.handleImplicitFlowCallback(message.url)
```

### 4. Token处理 (Token Processing)

#### 4.1 解析访问令牌
```typescript
const fragment = successUrl.split('#')[1]
const params = new URLSearchParams(fragment)
const accessToken = params.get('access_token')
const instanceUrl = params.get('instance_url')
```

#### 4.2 获取用户信息
```typescript
const userInfo = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
```

#### 4.3 创建组织对象
```typescript
const organization: Organization = {
  id: userInfo.organization_id,
  name: userInfo.organization_name || extractedOrgName,
  username: userInfo.preferred_username,
  email: userInfo.email,
  orgType: 'Production' | 'Sandbox',
  domain: instanceUrl
}
```

### 5. 安全存储 (Secure Storage)

#### 5.1 XOR加密存储
```typescript
// 加密敏感数据
const encryptedData = await this.encrypt(jsonData)

// 存储到Chrome本地存储
await chrome.storage.local.set({
  'ultraforce_auth_v2': encryptedData
})
```

#### 5.2 认证数据结构
```typescript
interface AuthData {
  accessToken: string
  refreshToken: string
  instanceUrl: string
  userId: string
  orgId: string
  orgName: string
  orgType: 'Production' | 'Sandbox'
  domain: string
  expiresAt: number
  issuedAt: number
}
```

## 关键修复 (Key Fixes)

### 1. 重复消息处理修复
**问题**: OAuth回调被处理多次
**解决方案**:
```typescript
private currentMessageListener: ((message: any) => void) | null = null

private cleanupMessageListener(): void {
  if (this.currentMessageListener) {
    chrome.runtime.onMessage.removeListener(this.currentMessageListener)
    this.currentMessageListener = null
  }
}
```

### 2. UI状态更新修复
**问题**: 认证成功后模态框关闭，用户需重新打开
**解决方案**:
```typescript
// 认证成功后不关闭模态框
// handleClose() // 移除这行

// 刷新认证状态，自动切换到搜索界面
await initializeAuthentication()
```

### 3. 组织名称显示修复
**问题**: 显示用户名而不是组织名
**解决方案**:
```typescript
// 使用正确的组织名称字段
name: userInfo.organization_name || this.extractOrgNameFromUrl(instanceUrl)
```

## 错误处理 (Error Handling)

### 1. 网络错误
```typescript
try {
  const response = await fetch(...)
} catch (error) {
  throw new AuthError('Network error', orgId, true) // retryable
}
```

### 2. Token过期
```typescript
if (this.isTokenExpired(orgId)) {
  return await this.refreshTokenWithRetry(orgId)
}
```

### 3. OAuth错误
```typescript
if (error) {
  this.pendingAuthReject(new AuthError(`OAuth error: ${error}`))
  this.cleanupMessageListener()
}
```

## 安全考虑 (Security Considerations)

1. **XOR加密**: 敏感数据使用XOR加密存储
2. **Token过期**: 自动检测和刷新过期token
3. **HTTPS Only**: 仅支持HTTPS的Salesforce域名
4. **状态验证**: OAuth状态参数验证(可选启用)
5. **权限最小化**: 仅请求必要的OAuth权限

## 支持的Salesforce域名 (Supported Domains)

- `*.salesforce.com`
- `*.lightning.force.com`
- `*.my.salesforce.com`
- `*.sandbox.my.salesforce.com`
- `*.sfcrmapps.cn` (中国区)
- 其他Salesforce相关域名

## API参考 (API Reference)

### 主要方法
```typescript
// 初始化认证系统
await initializeAuth()

// 启动OAuth流程
await authenticateOrg(isSandbox?: boolean)

// 获取认证的组织列表
getAuthenticatedOrgs(): Organization[]

// 获取有效访问令牌
await getValidOrgToken(orgId: string)

// 移除组织认证
await removeOrgAuth(orgId: string)
```

### 认证状态检查
```typescript
// 检查是否有认证的组织
const hasAuth = getAuthenticatedOrgs().length > 0

// 根据域名查找组织
const org = auth.findOrganizationByDomain(window.location.hostname)
```

## 故障排除 (Troubleshooting)

### 常见问题

1. **认证后模态框仍显示认证界面**
   - 检查 `hasAuthenticatedOrgs` 状态是否正确更新
   - 确保 `initializeAuthentication()` 被正确调用

2. **组织名称显示为undefined**
   - 检查 `userInfo.organization_name` 字段
   - 确保从正确的字段映射组织名称

3. **重复的OAuth回调处理**
   - 检查消息监听器是否正确清理
   - 确保 `cleanupMessageListener()` 被调用

4. **Token刷新失败**
   - 检查网络连接
   - 验证refresh token是否有效
   - 检查Salesforce组织设置

### 调试日志

启用详细日志以调试问题:
```javascript
// 在控制台中查看认证相关日志
// AUTH - 认证相关
// OAUTH - OAuth流程
// SUCCESS - 成功操作
// ERROR - 错误信息
// CALLBACK - 回调处理
```

## 版本历史 (Version History)

### v2.0 - 当前版本
- 实现Implicit OAuth 2.0流程
- 添加XOR加密存储
- 修复重复消息处理
- 修复UI状态更新
- 修复组织名称显示

### v1.0 - 遗留版本
- 基于PKCE的OAuth实现(已废弃)
- 基本token管理功能
