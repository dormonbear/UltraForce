# UltraForce Metadata API 技术文档

## 概述

UltraForce使用Salesforce Tooling API实现元数据搜索功能，替代传统的复杂SOQL查询方案。本文档详细说明了当前架构、支持的元数据类型以及扩展方案。

## 架构设计

### 核心架构

```
用户输入 -> Tooling API并行查询 -> 客户端过滤 -> 结果展示
```

**优势：**
- 绕过SOQL复杂字段限制（如EntityDefinition的OR查询限制）
- 避免权限和访问控制问题
- 客户端过滤提供更好的用户体验
- 并行查询提高性能

### 技术栈

- **API**: Salesforce Tooling API (`/services/data/v45.0/tooling/query`)
- **认证**: Session ID from Lightning Experience
- **查询方式**: 批量获取 + 客户端过滤
- **支持类型**: 标准Salesforce对象

## 当前实现

### 支持的元数据类型

| 类型 | Tooling Object | 查询字段 | 搜索字段 | 状态 |
|-----|----------------|----------|-----------|------|
| ApexClass | ApexClass | Id, Name, NamespacePrefix, LastModifiedDate | Name | 正常 |
| ApexTrigger | ApexTrigger | Id, Name, NamespacePrefix, LastModifiedDate | Name | 正常 |
| CustomObject | EntityDefinition | QualifiedApiName, Label, DurableId | QualifiedApiName, Label | 已实现 |
| CustomField | FieldDefinition | Id, QualifiedApiName, MasterLabel, DataType | QualifiedApiName, MasterLabel, ObjectApiName | 已实现 |
| Flow | Flow | Id, MasterLabel, VersionNumber, Status | MasterLabel | 正常 |
| User | User | Id, Name, Username, IsActive | Name, Username | 已修复 |
| PermissionSet | PermissionSet | Id, Name, Label, NamespacePrefix | Name, Label | 已实现 |
| Profile | Profile | Id, Name | Name | 已实现 |

### 核心函数

```typescript
/**
 * 主搜索入口 - 并行查询多种元数据类型
 */
async function searchSalesforceMetadata(
  query: string,
  selectedTypes: string[],
  organization: Organization
): Promise<Record<string, SearchResult[]>>

/**
 * 单类型元数据查询 - 使用Tooling API
 */
async function listMetadata(
  metadataType: string, 
  organization: Organization
): Promise<any[]>

/**
 * 客户端过滤 - 按搜索词筛选结果
 */
function filterMetadataByQuery(
  metadataList: any[], 
  query: string, 
  metadataType: string
): SearchResult[]
```

## API调用示例

### 1. ApexClass查询

```http
GET /services/data/v45.0/tooling/query?q=SELECT%20Id%2C%20Name%2C%20NamespacePrefix%2C%20LastModifiedDate%20FROM%20ApexClass%20ORDER%20BY%20Name%20ASC%20LIMIT%20100
Authorization: Bearer {sessionId}
```

### 2. Flow查询

```http
GET /services/data/v45.0/tooling/query?q=SELECT%20Id%2C%20MasterLabel%2C%20VersionNumber%2C%20Status%20FROM%20Flow%20ORDER%20BY%20MasterLabel%20ASC%20LIMIT%20100
Authorization: Bearer {sessionId}
```

## 错误处理

### 常见错误类型

1. **字段不存在错误**
   ```
   No such column 'Email' on entity 'User'
   ```
   **解决**: 移除不支持的字段

2. **权限错误**
   ```
   INSUFFICIENT_ACCESS: insufficient access rights on object id
   ```
   **解决**: 调整查询字段或使用标准API

3. **会话过期**
   ```
   Session expired. Please refresh your authentication.
   ```
   **解决**: 重新检测Salesforce会话

### 错误恢复策略

- 自动重试机制
- 优雅降级到基础字段
- 用户友好的错误提示

## 扩展计划

### 阶段1: 基础元数据类型
- [x] ApexClass, ApexTrigger, Flow
- [x] User对象字段修复

### 阶段2: 复杂元数据类型
- [x] **CustomObject** - 使用EntityDefinition实现
- [x] **CustomField** - 两步查询法解决FieldDefinition限制
- [x] **PermissionSet/Profile** - 权限管理对象
- [ ] **Layout** - 页面布局

### 阶段3: 高级功能
- [ ] **Lightning Component** - 现代UI组件
- [ ] **Validation Rule** - 验证规则
- [ ] **Workflow Rule** - 工作流规则
- [ ] **Report/Dashboard** - 报表和仪表板

## CustomObject实现方案

### 采用方案: EntityDefinition
```typescript
soql = `SELECT QualifiedApiName, Label, DurableId FROM EntityDefinition WHERE IsCustomizable = true ORDER BY QualifiedApiName ASC LIMIT 200`
```

**优势**: 
- 标准API，稳定可靠
- 包含所有可自定义对象（标准+自定义）
- 避免权限问题

**实现细节**:
- 使用 `IsCustomizable = true` 过滤条件
- 返回 `QualifiedApiName` 作为主要标识
- `DurableId` 作为备用ID

## CustomField实现方案

### 采用方案: 两步查询法
```typescript
// 步骤1: 获取自定义对象列表
const objectsQuery = `SELECT QualifiedApiName, DurableId FROM EntityDefinition WHERE IsCustomizable = true AND IsCustomSetting = false ORDER BY QualifiedApiName ASC LIMIT 50`

// 步骤2: 为每个对象查询自定义字段
const fieldsQuery = `SELECT Id, QualifiedApiName, MasterLabel, DataType, EntityDefinition.QualifiedApiName FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${objectName}' AND IsCustom = true ORDER BY QualifiedApiName ASC LIMIT 50`
```

**优势**:
- 解决了 `filter on a reified column is required` 错误
- 精确查询每个对象的自定义字段
- 包含字段数据类型和父对象信息

**性能优化**:
- 限制查询对象数量（前10个对象）
- 并发查询但有错误处理
- 缓存结果避免重复查询

## 性能优化

### 当前优化
- 并行API调用
- 客户端缓存结果
- 限制每次查询100条记录
- 防抖搜索输入

### 计划优化
- [ ] **智能缓存**: 本地存储元数据列表
- [ ] **增量更新**: 基于LastModifiedDate的增量查询
- [ ] **分页加载**: 大数据量分批加载
- [ ] **搜索索引**: 客户端全文搜索索引

## 安全考虑

- 使用当前用户的Session ID，继承用户权限
- 不存储敏感信息，仅查询元数据
- 遵循Salesforce API限制和最佳实践
- 错误信息不泄露系统内部信息

## 测试策略

### 单元测试
- API调用模拟
- 错误处理验证
- 数据转换正确性

### 集成测试
- 真实Salesforce环境测试
- 不同组织类型验证
- 权限场景测试

### 用户测试
- 搜索响应时间
- 结果准确性验证
- 边界条件处理

## 版本历史

### v1.0 (当前)
- 基于Tooling API的基础实现
- 支持ApexClass, ApexTrigger, Flow
- 客户端过滤搜索

### v1.1 (已完成)
- CustomObject和CustomField支持
- PermissionSet和Profile支持
- 两步查询法解决复杂过滤需求
- 增强的URL构建和导航

### v1.2 (计划)
- Layout和更多UI组件支持
- Lightning Component查询
- 性能优化和增量缓存

---

## 快速开始

1. **环境要求**: 有效的Salesforce会话
2. **调用方式**: `searchSalesforceMetadata(query, types, org)`
3. **结果格式**: `Record<string, SearchResult[]>`

**示例**:
```typescript
const results = await searchSalesforceMetadata(
  "Account", 
  ["ApexClass", "Flow"], 
  currentOrg
)
// 返回: { ApexClass: [...], Flow: [...] }
```
