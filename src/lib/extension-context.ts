function extensionId(): string | undefined {
  try {
    return chrome.runtime?.id
  } catch {
    return undefined
  }
}

export function isExtensionContextValid(): boolean {
  return Boolean(extensionId())
}

export function claimExtensionScript(name: string): (() => void) | undefined {
  const id = extensionId()
  if (!id) return

  let version: string
  try {
    version = chrome.runtime.getManifest().version
  } catch {
    return
  }

  const marker = Symbol.for(`ultraforce:${id}:${version}:${name}`)
  if (Reflect.has(window, marker)) return

  Reflect.set(window, marker, true)
  return () => {
    Reflect.deleteProperty(window, marker)
  }
}
