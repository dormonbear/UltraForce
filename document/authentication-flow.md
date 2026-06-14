# UltraForce Authentication Flow Documentation

## Overview
UltraForce扩展的认证系统通过多种方式获取Salesforce会话令牌，支持经典版和Lightning Experience的认证。

## 认证流程

### 1. Background Script 初始化认证

#### 自动检测 (`initSearchButtonForLightningAndVF`)
- **触发时机**: Chrome标签页更新完成时自动调用
- **检测域名**: `.lightning.force.com`, `.visual.force.com`, `.visualforce.com`
- **组织匹配**: 通过URL域名匹配存储的组织凭据

```javascript
function initSearchButtonForLightningAndVF(tabId, tabUrl) {
    // 1. 从URL提取组织key
    let orgKey = tabUrl.split("/")[2];
    
    // 2. 从Chrome存储中获取凭据
    chrome.storage.local.get("Credential", function (result) {
        // 3. 查找匹配的组织
        for (const username in credentials) {
            if (orgDomain === orgKey.toLowerCase()) {
                matchingOrg = credentials[username];
                break;
            }
        }
        
        // 4. 发送消息给内容脚本
        if (matchingOrg) {
            // 测试并刷新认证
            sendLoginRequest(matchingOrg, function (loginResult) {
                chrome.tabs.sendMessage(tabId, {
                    action: "INIT_SEARCH_BUTTON_WITH_TOKEN",
                    org: matchingOrg
                });
            });
        } else {
            chrome.tabs.sendMessage(tabId, {action: "INIT_SEARCH_BUTTON_ONLY"});
        }
    });
}
```

### 2. Content Script 会话获取

#### Lightning Experience 会话检测
```javascript
function tryGetLightningSession() {
    try {
        // 方法1: 使用$A.get获取会话ID
        if (window.$A && window.$A.get) {
            return window.$A.get("$SfdcPage.Org.SessionId");
        }
    } catch(e) {}
    
    try {
        // 方法2: 使用Aura上下文获取令牌
        if (window.Aura && window.Aura.getContext) {
            var context = window.Aura.getContext();
            if (context && context.getToken) {
                return context.getToken();
            }
        }
    } catch(e) {}
    
    return null;
}
```

#### 经典版会话检测
```javascript
// 从Cookie获取会话ID
pageSessionId = getCookie("sid");
```

### 3. 消息通信机制

#### Background → Content Script
- `INIT_SEARCH_BUTTON_ONLY`: 无认证情况下初始化搜索按钮
- `INIT_SEARCH_BUTTON_WITH_TOKEN`: 带认证信息初始化搜索按钮

#### Content Script → Background
- `ONLINE_SEARCH_START`: 发起在线搜索请求
- `FORCE_INIT_SEARCH_BUTTON`: 强制初始化搜索按钮

### 4. 认证存储结构

#### Chrome Storage - "Credential"
```javascript
{
  "username@domain.com": {
    "Username": "username@domain.com",
    "Password": "encrypted_password", 
    "Token": "security_token",
    "Domain": "https://domain.salesforce.com",
    "SessionId": "current_session_id",
    "Type": "Production" // or "Sandbox"
  }
}
```

## 认证方式

### 1. OAuth 2.0 认证
- **CLIENT_ID**: `<YOUR_CONNECTED_APP_CLIENT_ID>`
- **生产环境**: `https://login.salesforce.com`
- **沙盒环境**: `https://test.salesforce.com`

### 2. 用户名/密码认证
- SOAP API登录
- 获取会话令牌和服务器URL
- 存储认证信息到Chrome Storage

### 3. 会话检测优先级
1. **Background Script消息**: 最高优先级，来自存储的认证信息
2. **Lightning会话检测**: `window.$A.get("$SfdcPage.Org.SessionId")`
3. **Cookie会话**: `getCookie("sid")`

## 问题和解决方案

### 当前问题: "No Salesforce Session"
**原因**: 模块化重构后，认证流程被中断

**解决方案**:
1. 恢复会话检测逻辑
2. 确保Background Script正常发送认证消息
3. 添加Lightning Experience会话检测
4. 实现Cookie会话检测备用方案

### API端点生成
```javascript
// SOAP端点
const soapEndpoint = domain + "/services/Soap/c/45.0/";

// REST API端点
const restEndpoint = domain + "/services/data/v45.0/query/?q=";

// Tooling API端点  
const toolingEndpoint = domain + "/services/data/v45.0/tooling/query/?q=";
```

## 中国区支持
- **域名**: `.sfcrmapps.cn`
- **登录URL**: `https://login.sfcrmapps.cn`
- **URL转换**: Lightning URL自动转换逻辑

## 安全注意事项
1. 会话令牌不应记录到控制台
2. 密码采用加密存储
3. 定期刷新会话令牌
4. 支持令牌过期自动重新认证