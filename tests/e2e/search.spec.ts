import { test, expect } from './fixtures/extension'
import { UltraForcePage } from './pages/ultraforce.page'

test.describe('Search Commands', () => {
  let uf: UltraForcePage

  test.beforeAll(async ({ extensionPage, extensionContext, baseUrl }) => {
    uf = new UltraForcePage(extensionPage, extensionContext, baseUrl)
  })

  test('search ASR custom objects with :o', async () => {
    await uf.openModal()
    await uf.clearAndType(':o ASR_Hotel')
    await uf.wait(2000)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.closeModal()
  })

  test('search WeatherService Apex with :c', async () => {
    await uf.openModal()
    await uf.clearAndType(':c Weather')
    await uf.wait(2000)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.closeModal()
  })

  test('search CreateCase Flow with :f', async () => {
    await uf.openModal()
    await uf.clearAndType(':f Create')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('search Dormon user with :u', async () => {
    await uf.openModal()
    await uf.clearAndType(':u Dormon')
    await uf.wait(2000)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.closeModal()
  })

  test('search Admin profile with :p', async () => {
    await uf.openModal()
    await uf.clearAndType(':p Admin')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('search Custom Labels with :l', async () => {
    await uf.openModal()
    await uf.clearAndType(':l')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('search Custom Metadata with :m', async () => {
    await uf.openModal()
    await uf.clearAndType(':m')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('search Queues with :q', async () => {
    await uf.openModal()
    await uf.clearAndType(':q')
    await uf.wait(2000)
    await uf.closeModal()
  })

  test('show Setup shortcuts with :g', async () => {
    await uf.openModal()
    await uf.clearAndType(':g apex')
    await uf.wait(1500)
    await uf.pressKey('ArrowDown')
    await uf.wait(200)
    await uf.closeModal()
  })
})
