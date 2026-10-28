# Manifest policy compatibility / 清单策略兼容性

The patch for `@plasmohq/parcel-transformer-manifest@0.21.1` adapts the fixed CSP parser's Map result to the transformer's existing object access. It normalizes the result with `Object.assign(Object.create(null), Object.fromEntries(...))`, keeping directive names as own data properties without inheriting prototype entries. All other published transformer code is preserved.

`@plasmohq/parcel-transformer-manifest@0.21.1` 的补丁将已修复 CSP 解析器返回的 Map 适配为转换器既有的对象访问形式。使用 `Object.assign(Object.create(null), Object.fromEntries(...))` 规范化结果，让指令名保持为自有数据属性，不继承原型条目。其余已发布转换器代码保持不变。

The unpatched 0.21.1 transformer drops existing directives because it indexes and enumerates the Map as an object. Run `node --test scripts/manifest-policy.test.mjs scripts/manifest-policy-build.test.mjs` before removing or updating this patch. These tests cover prototype safety, policy preservation, and actual production/development CLI manifests using isolated synthetic fixtures.

未修补的 0.21.1 转换器将 Map 当作对象进行下标访问和枚举，导致既有指令丢失。移除或更新补丁前，运行 `node --test scripts/manifest-policy.test.mjs scripts/manifest-policy-build.test.mjs`。这些测试使用隔离合成夹具，覆盖原型安全、策略保留及实际生产／开发 CLI 清单。
