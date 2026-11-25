import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import { GLASS, grid } from './grid'
import { makeColors } from './make-colors.js'
import { choose, keep, NONE, release, themeFor } from './theme-choice'

const THEME = 'electron-vue'
const SCENE = 'electron-vue-dot-grid'
const COMMAND = 'electron-vue'

// The Electron Vue VS Code theme (icao.electron-vue): slate-navy grays from
// the activity bar (#141820) through the side bar (#1b212c) to the editor
// (#212836), Vue green for everything active, and its syntax colors for the
// roles.
const { theme, problems } = makeColors({
  label: 'Electron Vue',
  only: 'dark',
  codeTheme: { dark: 'material-theme-palenight' },
  roles: {
    accent: { seed: '#37c886', fillShade: 300, stops: { 300: '#37c886' } },
    danger: '#ff4579',
    success: '#6af699',
    warning: '#facf5a',
    pro: '#c792ea',
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#141820',
        'surface-1': '#1b212c',
        'surface-2': '#212836',
        'surface-3': '#262e3d',
        'text-primary': '#f8fafd',
        'text-secondary': '#bac7e4',
        'text-muted': '#99a3b8',
      },
    },
    git: { added: '#6af699', removed: '#ff4579', modified: '#ffbf7a', merged: '#c792ea', conflicting: '#facf5a' },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: SCENE, glass: GLASS },
  style: {
    Heading: { color: '#37c886' },
    // A selected list row in the editor, with the focus border's green.
    UserMessage: {
      color: '#f8fafd',
      backgroundColor: '#2a3242',
      borderColor: '#37c88666',
      borderWidth: 1,
      radius: 6,
      paddingX: 14,
      paddingY: 10,
    },
    // A widget: the side bar's color, solid over the grid.
    ToolUse: {
      color: '#bac7e4',
      backgroundColor: '#1b212c',
      borderColor: '#d1dfff1a',
      borderWidth: 1,
      radius: 4,
      paddingX: 8,
    },
  },
}

/** The same look without `style`, for a build that doesn't take it. */
const PLAIN: ThemeSetArgs = { colors: LOOK.colors, overrideColorScheme: 'dark', backdrop: LOOK.backdrop }

async function applyLook($: EngineInterface): Promise<void> {
  const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

  if (unpainted !== undefined) {
    $.ui.log(`electron-vue: ${unpainted}`)
  }
  let set

  try {
    set = await $.theme.set(LOOK)
  } catch (error) {
    $.ui.log(`electron-vue: message style refused, using colors alone: ${String(error)}`, { to: 'debug' })
    set = await $.theme.set(PLAIN)
  }

  if (!set.isDrawn) {
    $.ui.log(`electron-vue: ${set.reason}`, { to: 'debug' })
  }
}

/** Whether this session wears Electron Vue. Before any theme mod saved a choice, it doesn't. */
async function isOn($: EngineInterface): Promise<boolean> {
  return (await themeFor($, NONE)) === THEME
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: COMMAND,
        description: 'Electron Vue theme with a dot-grid chat: on or off, here and in new sessions',
        argumentHint: '[on|off|status]',
      })
    } catch (error) {
      $.ui.log(`electron-vue: /${COMMAND} not registered yet: ${String(error)}`, { to: 'debug' })
    }

    // The rest of the chain first, so a theme another mod sets as the
    // session starts is in place before this one goes over it.
    const started = await next(e)

    if (await isOn($)) {
      await applyLook($)
      await keep($, THEME)
    }

    return started
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== SCENE) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={grid()} alt="A faint dot grid, like graph paper, on slate blue" />
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    const wasOn = await isOn($)

    if (arg === 'status') {
      return {
        text: wasOn
          ? 'Electron Vue is on in this session.'
          : 'Electron Vue is off in this session. Turn it on with /electron-vue.',
        isTextDisplayOnly: true,
      }
    }
    const turnOn = arg === 'on' ? true : arg === 'off' ? false : arg === '' ? !wasOn : undefined

    if (turnOn === undefined) {
      return { text: 'Usage: /electron-vue [on|off|status]. With nothing, it toggles.', isTextDisplayOnly: true }
    }

    if (turnOn) {
      await applyLook($)
      await choose($, THEME)

      return {
        text: 'Electron Vue is on in this session, and new sessions will start with it. Sessions already open keep their own theme.',
        isTextDisplayOnly: true,
      }
    }

    if (!wasOn) {
      // This session wears another theme or none: leave it, and only stop
      // new sessions starting with this one.
      return {
        text: (await release($, THEME))
          ? 'Electron Vue isn’t on in this session, so it stays as it is; new sessions will start without it.'
          : 'Electron Vue isn’t on in this session, so nothing changed.',
        isTextDisplayOnly: true,
      }
    }
    // Clear only a theme this mod put up: one theme stands per session.
    await $.theme.clear()
    await choose($, NONE)

    return {
      text: 'Electron Vue is off in this session, and new sessions will start without it. Turn it back on with /electron-vue.',
      isTextDisplayOnly: true,
    }
  }).catch(() => ({ text: 'Electron Vue could not finish that; try /electron-vue again.', isTextDisplayOnly: true }))
}
