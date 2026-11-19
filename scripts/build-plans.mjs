// Generates the reading-plan definitions in src/features/plans/data/.
// Run with: node scripts/build-plans.mjs
// Days are contiguous runs of chapters in canonical order, balanced by verse
// count (read from the KJV file) so that no day is much longer than another.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const kjv = JSON.parse(readFileSync(resolve(root, 'public/data/kjv.json'), 'utf8'))
const outDir = resolve(root, 'src/features/plans/data')
mkdirSync(outDir, { recursive: true })

const NT_START = 39

function chaptersOf(books) {
  return books.flatMap((b) => b.chapters.map((c) => ({ book: b.name, chapter: Number(c.chapter), verses: c.verses.length })))
}

/** Split chapters into `dayCount` contiguous days with roughly equal verse totals. */
function split(chapters, dayCount) {
  const total = chapters.reduce((n, c) => n + c.verses, 0)
  const days = []
  let i = 0, read = 0
  for (let d = 0; d < dayCount; d++) {
    const target = (total * (d + 1)) / dayCount
    const day = []
    const mustLeave = dayCount - d - 1 // at least one chapter for every later day
    while (i < chapters.length - mustLeave) {
      const next = chapters[i]
      // Take the chapter if the day is empty, or if taking it lands closer to the target than stopping.
      if (day.length && Math.abs(read + next.verses - target) > Math.abs(read - target)) break
      day.push([next.book, next.chapter]); read += next.verses; i++
    }
    days.push(day)
  }
  while (i < chapters.length) { days[days.length - 1].push([chapters[i].book, chapters[i].chapter]); i++ }
  return days
}

const plans = [
  {
    key: 'john-21',
    name: 'The Gospel of John in 21 days',
    description: 'One chapter a day through the fourth Gospel.',
    days: split(chaptersOf(kjv.books.filter((b) => b.name === 'John')), 21),
  },
  {
    key: 'nt-90',
    name: 'The New Testament in 90 days',
    description: 'Matthew to Revelation, about three chapters a day.',
    days: split(chaptersOf(kjv.books.slice(NT_START)), 90),
  },
  {
    key: 'bible-365',
    name: 'The whole Bible in a year',
    description: 'Genesis to Revelation in canonical order, three or four chapters a day.',
    days: split(chaptersOf(kjv.books), 365),
  },
]

for (const plan of plans) {
  const count = plan.days.reduce((n, d) => n + d.length, 0)
  if (plan.days.some((d) => d.length === 0)) throw new Error(`${plan.key}: empty day`)
  writeFileSync(resolve(outDir, `${plan.key}.json`), JSON.stringify(plan) + '\n')
  console.log(`${plan.key}: ${plan.days.length} days, ${count} chapters, longest day ${Math.max(...plan.days.map((d) => d.length))} chapters`)
}
