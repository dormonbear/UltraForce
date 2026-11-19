interface ContentScriptEntry {
  matches?: string[]
  js?: string[]
  world?: string
}

async function injectIntoOpenTabs({ matches, js, world }: ContentScriptEntry): Promise<void> {
  if (!matches?.length || !js?.length) return

  try {
    const tabs = await chrome.tabs.query({ url: matches })
    await Promise.allSettled(
      tabs.map(async ({ id, discarded, status }) => {
        if (id === undefined || id < 0 || discarded || status === 'unloaded') return
        await chrome.scripting.executeScript({
          target: { tabId: id },
          files: js,
          world: world === 'MAIN' ? 'MAIN' : 'ISOLATED',
          injectImmediately: true
        })
      })
    )
  } catch {
    // A failed query must not affect other scripts. / 查询失败时继续处理其他脚本。
  }
}

async function reinjectRegisteredScripts(): Promise<void> {
  // Plasmo registers MAIN-world scripts at runtime. / Plasmo 在运行时注册主世界脚本。
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts()
    await Promise.all(scripts.map(injectIntoOpenTabs))
  } catch {
    // Manifest scripts can still be injected. / 清单中的脚本仍可重新注入。
  }
}

export async function reinjectContentScripts(reason: chrome.runtime.InstalledDetails['reason']): Promise<void> {
  if (reason !== 'install' && reason !== 'update') return

  const scripts = chrome.runtime.getManifest().content_scripts ?? []
  await Promise.all([...scripts.map(injectIntoOpenTabs), reinjectRegisteredScripts()])
}
