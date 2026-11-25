# Electron Vue

A Claude Code theme after the [Electron Vue](https://github.com/icao/electron-vue) VS Code theme: slate-navy grays from the activity bar (#141820) through the side bar (#1b212c) to the editor (#212836), Vue green (#37c886) for buttons, links, focus and headings, and the theme's own syntax colors for status and git.

The chat sits on a faint dot grid, a dot every 20 points and a slightly brighter one every 100, for a light graph-paper feel. The app lays an unblurred veil of the side bar's color over the backdrop, so the grid is drawn brighter beneath it and reads as the editor color (#212836) with faint dots once veiled.

It draws in the Claude desktop and mobile apps. The terminal and editors don't draw themes.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install electron-vue --marketplace nilswhite/electron-vue-theme
```

Answer `y` to add the marketplace, then press Enter to install for your user, so it loads in every session.

Or from a shell:

```bash
claude plugin install electron-vue --marketplace nilswhite/electron-vue-theme
```

In the Claude desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `nilswhite/electron-vue-theme`, then **Add plugin**. A theme installed from a terminal for your user also shows in the desktop app's sessions.

It starts off: type `/electron-vue` in a session to turn it on.

## Commands

| Command | What it does |
| --- | --- |
| `/electron-vue` | Toggle the theme in this session |
| `/electron-vue on` / `/electron-vue off` | Turn it on or off explicitly |
| `/electron-vue status` | Say whether this session wears it |

## Each session keeps its own theme

Turning the theme on or off sets it for this session and for every session you start afterwards. Sessions already open keep whatever they have, and a session you resume comes back with the theme it last wore. So you can have Electron Vue in one session and another theme in the next.

`/electron-vue off` in a session that wears another theme leaves that session alone and only stops new sessions starting with Electron Vue.

The choice lives in `~/.claude/theme-mods/choice.json`, which other theme mods can read too: `default` is what a new session starts with, and `sessions` pins each session to its own theme. [Starry Canyon](https://github.com/nilswhite/starry-canyon) reads the same file, so switching between the two works the same way in both.

## License

MIT, except `hooks/make-colors.js` and `hooks/make-colors.d.ts`, which come from Claude Code's plugin-authoring kit. The colors follow the Electron Vue VS Code theme by César Aparicio, also MIT. See [LICENSE](LICENSE).
