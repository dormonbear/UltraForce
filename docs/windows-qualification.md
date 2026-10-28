# Windows qualification / Windows 验证

CI retains the existing Ubuntu checks and adds Windows quality/coverage, production,
and synthetic browser jobs with Node 22 and pnpm 9.15.9. Frozen installation applies
both checked-in pnpm patches without changing package versions or the lockfile.

CI 保留既有 Ubuntu 检查，新增使用 Node 22 与 pnpm 9.15.9 的 Windows 质量／覆盖率、
正式构建及合成浏览器任务。冻结安装应用两项已提交 pnpm 补丁，不改变版本或锁文件。

Windows runs every frontend unit test with the existing coverage thresholds, plus
the dependency/native regressions, including actual Sharp icon generation and
LMDB/Parcel cache reopen tests. Production jobs build, verify schema/fonts, run
fresh-profile English/Chinese browser smoke checks and package the extension.
The separate synthetic job runs the same six cases from localization, auth-boundary,
privacy and setup-search-race. These cases use synthetic fixtures, never a real org.

Windows 执行全部前端单元测试并保留现有覆盖率阈值，同时执行依赖／原生回归，
包括实际 Sharp 图标生成及 LMDB／Parcel 缓存重新打开测试。正式任务构建、验证架构／字体、
使用全新配置文件运行中英文浏览器冒烟测试并打包扩展。独立合成任务执行 localization、
auth-boundary、privacy 及 setup-search-race 中相同六项用例，仅使用合成夹具，不接触真实组织。

Ubuntu remains the execution platform for release-workflow and Chrome Web Store
publisher contracts, matching the Bash/zip release workflow. The existing POSIX
glob CLI metacharacter case stays POSIX-only: its filename contains characters
Windows forbids. Its ZIP/glob/brace library siblings run on both platforms.
No failing cross-platform test is excluded from Windows qualification.

Ubuntu 继续执行发布流程及 Chrome 应用商店发布器契约，与 Bash／zip 发布流程的平台一致。
现有 POSIX glob CLI 元字符用例仍仅在 POSIX 执行，因为文件名含 Windows 禁用字符；
同文件中的 ZIP／glob／花括号库用例在两平台均执行。不会从 Windows 验证排除失败的跨平台测试。

Production and E2E jobs use separate checkouts because both Plasmo commands write
`build/chrome-mv3-prod`. Only production jobs upload extension build artifacts.
`pnpm build:e2e` uses a Node child process with an explicit environment and literal
arguments, avoiding POSIX assignment and Windows command shim differences.

正式与 E2E 任务分别检出，因为两个 Plasmo 命令均写入 `build/chrome-mv3-prod`。
只有正式任务上传扩展构建产物。`pnpm build:e2e` 使用显式环境及字面参数的 Node 子进程，
避免 POSIX 赋值语法及 Windows 命令包装差异。

Local macOS results do not prove Windows compatibility. Hosted Windows jobs must
pass on the reviewed commit before claiming qualification; failures require diagnosis.

本地 macOS 结果不能证明 Windows 兼容。必须在待审提交上通过托管 Windows 任务后，
才能宣称验证完成；出现失败须继续诊断。
