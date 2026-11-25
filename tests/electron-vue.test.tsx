import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ThemeSetArgs } from 'claude-code'

const SCENE = 'electron-vue-dot-grid'

const BACKDROP = {
  plugin: 'electron-vue',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: SCENE, plugin: 'electron-vue', glass: false },
} as const

type Saved = { default: string; sessions: Record<string, { theme: string; at: number }> }

// The engine beneath the plugin: themes and the order things happen in are
// recorded, the file system is a map, and the session id is the test's to set.
function engine(on: On, options: { refuseStyle?: boolean } = {}) {
  const themes: ThemeSetArgs[] = []
  const clears: number[] = []
  const order: string[] = []
  const files = new Map<string, string>()
  const session = { id: 'session-a' }

  on('command.register', () => ({ value: { command: 'electron-vue' } }))
  on('theme.set', (_, e) => {
    if (options.refuseStyle === true && e.style !== undefined) {
      throw new Error('style is not a theme attribute this build knows')
    }
    themes.push(e)
    order.push('theme')

    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('theme.clear', () => {
    clears.push(1)

    return { value: { isDrawn: false, reason: 'cleared' } }
  })
  on('session.id', () => ({ value: session.id }))
  on('fs.exists', (_, e) => ({ value: files.has(e.path) }))
  on('fs.read', (_, e) => {
    const text = files.get(e.path)

    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: text }
  })
  on('fs.write', (_, e) => {
    files.set(e.path, e.text)

    return { value: undefined }
  })
  on('session.start', (_, e) => {
    order.push('chain')

    return { cwd: e.cwd }
  })
  on('command.run', () => ({ text: 'engine' }))

  const saved = (): Saved | undefined => {
    const entry = [...files.entries()].find(([path]) => path.endsWith('/theme-mods/choice.json'))

    return entry === undefined ? undefined : (JSON.parse(entry[1]) as Saved)
  }

  return { themes, clears, order, files, session, saved }
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

// The person typing `/electron-vue <args>` at the prompt.
const electronVue = ($: Engine, args = '') =>
  $.command.run({
    command: 'electron-vue',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })

test('nothing changes until the theme is turned on', async ($, on) => {
  const { themes, saved } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)

  expect(themes.length).toBe(0)
  expect(saved()).toBeUndefined()
  expect((await electronVue($, 'status')).text).toContain('off')
})

test('/electron-vue puts up the look and makes it the default for new sessions', async ($, on) => {
  const { themes, saved } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  const reply = await electronVue($)

  expect(reply.text).toContain('on')
  expect(themes.length).toBe(1)
  expect(themes[0]?.backdrop).toEqual(expect.objectContaining({ scene: SCENE }))
  expect(themes[0]?.overrideColorScheme).toBe('dark')
  expect(themes[0]?.style?.UserMessage).toBeDefined()
  expect(saved()).toEqual({ default: 'electron-vue', sessions: { 'session-a': { theme: 'electron-vue', at: 1_000 } } })
  expect((await electronVue($, 'status')).text).toContain('is on')
})

test('each session keeps its own theme, and new sessions take the last choice', async ($, on) => {
  const { themes, clears, session, saved } = engine(on)
  mock.store(on)
  const clock = mock.clock(on, { now: 1_000 })

  // Session A turns it on.
  await start($)
  await electronVue($, 'on')
  expect(themes.length).toBe(1)

  // A new session B starts with it, then turns it off.
  session.id = 'session-b'
  await clock.advance(1_000)
  await start($)
  expect(themes.length).toBe(2)
  expect(saved()?.sessions['session-b']?.theme).toBe('electron-vue')

  const off = await electronVue($, 'off')
  expect(off.text).toContain('off')
  expect(clears.length).toBe(1)
  expect(saved()?.default).toBe('none')

  // Session A, resumed, still wears it.
  session.id = 'session-a'
  await start($)
  expect(themes.length).toBe(3)

  // A brand-new session C starts plain, and so does B when resumed.
  session.id = 'session-c'
  await start($)
  session.id = 'session-b'
  await start($)
  expect(themes.length).toBe(3)

  // Off where it isn't on clears nothing: another mod's theme may stand.
  await electronVue($, 'off')
  expect(clears.length).toBe(1)
})

test('a session another theme mod pinned is left alone', async ($, on) => {
  const { themes, files, session } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  await electronVue($, 'on')
  const path = [...files.keys()].find(p => p.endsWith('/theme-mods/choice.json'))!
  const choice = JSON.parse(files.get(path)!) as Saved
  choice.sessions['session-s'] = { theme: 'starry-canyon', at: 500 }
  files.set(path, JSON.stringify(choice))

  session.id = 'session-s'
  await start($)

  expect(themes.length).toBe(1)
})

test('off in a session wearing another theme only stops new sessions starting with this one', async ($, on) => {
  const { themes, clears, files, session, saved } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  await electronVue($, 'on')

  // Another theme mod pinned this session to itself.
  const path = [...files.keys()].find(p => p.endsWith('/theme-mods/choice.json'))!
  const choice = JSON.parse(files.get(path)!) as Saved
  choice.sessions['session-s'] = { theme: 'starry-canyon', at: 500 }
  files.set(path, JSON.stringify(choice))
  session.id = 'session-s'

  const off = await electronVue($, 'off')

  expect(off.text).toContain('new sessions will start without it')
  expect(clears.length).toBe(0)
  expect(saved()?.default).toBe('none')
  expect(saved()?.sessions['session-s']?.theme).toBe('starry-canyon')
  expect(saved()?.sessions['session-a']?.theme).toBe('electron-vue')

  // Said again, there is nothing left to change.
  expect((await electronVue($, 'off')).text).toContain('nothing changed')
  expect(themes.length).toBe(1)
})

test('a damaged choice file counts as no choice', async ($, on) => {
  const { themes, files, session } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  await electronVue($, 'on')
  expect(themes.length).toBe(1)

  // Damage the file the mod wrote; a new session then starts plain.
  const path = [...files.keys()].find(p => p.endsWith('/theme-mods/choice.json'))!
  files.set(path, '{ not json')
  session.id = 'session-d'
  await start($)

  expect(themes.length).toBe(1)
  expect((await electronVue($, 'status')).text).toContain('off')

  // Turning it on again writes a good file over the damaged one.
  await electronVue($, 'on')
  expect(JSON.parse(files.get(path)!).default).toBe('electron-vue')
})

test('the look goes up after the rest of the session start, so it wins over a theme set there', async ($, on) => {
  const { order } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  await electronVue($, 'on')
  order.length = 0

  await start($)

  expect(order).toEqual(['chain', 'theme'])
})

test('a build that refuses message style still gets the colors and the grid', async ($, on) => {
  const { themes } = engine(on, { refuseStyle: true })
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  await electronVue($, 'on')

  expect(themes.length).toBe(1)
  expect(themes[0]?.style).toBeUndefined()
  expect(themes[0]?.backdrop).toEqual(expect.objectContaining({ scene: SCENE }))
})

// What a color drawn in the scene looks like through the glass the look sets.
function throughGlass(drawn: string, glass: { tint: string; opacity: number }): number[] {
  const channels = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
  const tint = channels(glass.tint)

  return channels(drawn).map((v, i) => Math.round(glass.opacity * tint[i]! + (1 - glass.opacity) * v))
}

test('the backdrop is a faint dot grid that reads as the editor color through the glass', async ($, on) => {
  const { themes } = engine(on)
  mock.store(on)
  mock.clock(on, { now: 1_000 })

  await start($)
  await electronVue($, 'on')
  const backdrop = themes[0]?.backdrop
  const glass = backdrop !== undefined && 'glass' in backdrop ? backdrop.glass : undefined

  // No blur: it would smear the dots behind the chat into haze.
  expect(glass).toEqual(expect.objectContaining({ blur: 0, tint: '#1b212c' }))

  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const svg = String((await ui.find({ type: 'Svg' }))?.props.source ?? '')
    await ui.unmount()

    expect(svg).toContain('<pattern id="minor" width="20" height="20"')
    expect(svg).toContain('<pattern id="major" width="100" height="100"')

    // The ground, seen through the glass, is the editor's #212836 (33, 40, 54).
    const base = /<rect width="1440" height="900" fill="(#[0-9a-f]{6})"\/>/.exec(svg)?.[1]
    expect(base).toBeDefined()
    const seen = throughGlass(base!, glass as { tint: string; opacity: number })
    seen.forEach((v, i) => expect(Math.abs(v - [33, 40, 54][i]!)).toBeLessThanOrEqual(1))
  }
})

test('another scene, or a surface that draws no backdrop, is left alone', async ($, on) => {
  engine(on)
  mock.store(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const other = await $.ui.mount({ ...BACKDROP, surface: 'desktop', props: { ...BACKDROP.props, scene: 'lagoon' } })
  expect((await other.find({ type: 'Text' }))?.text).toBe('engine')
  await other.unmount()

  const vscode = await $.ui.mount({ ...BACKDROP, surface: 'vscode' })
  expect((await vscode.find({ type: 'Text' }))?.text).toBe('engine')
  await vscode.unmount()
})
