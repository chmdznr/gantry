import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The @utility / @layer components blocks must resolve color only through tokens,
// so presets + dark work everywhere. Fail if a raw Tailwind palette color leaks in.
describe('token discipline in globals.css', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
  // token hex values legitimately live in @theme + preset/dark blocks (before @utility);
  // only the component layer must be palette-free.
  const layer = css.slice(css.indexOf('@utility'))
  const forbidden =
    /\b(?:bg|text|border|from|to|via|ring)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)-(?:50|[1-9]00|950)\b/g

  it('has no raw Tailwind palette colors in utilities/components', () => {
    const hits = layer.match(forbidden) ?? []
    expect(hits).toEqual([])
  })
})
