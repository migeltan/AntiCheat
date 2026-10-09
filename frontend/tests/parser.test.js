import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extractFormData,
  ParseError,
  parseGoogleForm,
  parseGoogleForms,
  toImportPayload,
  validateQuestions,
} from '../src/lib/quizParser'

// ---- builders that mimic the shape of FB_PUBLIC_LOAD_DATA_ ----
// item = [id, title, description, typeCode, [[entryId, options, required]]]
const opt = (label) => [label, null, null, null, 0]
const field = (options, required) => [111, options, required ? 1 : 0]
const item = (title, code, f) => [1, title, null, code, f ? [f] : null]
const choice = (title, labels, { code = 2, required = true } = {}) => item(title, code, field(labels.map(opt), required))
const text = (title, code = 0, required = false) => item(title, code, field(null, required))
const form = (title, items, description = '') => {
  const meta = []
  meta[0] = description
  meta[1] = items
  meta[8] = title
  return [null, meta, null, title]
}
const asPage = (data) => `<html><head></head><body><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(data)};</script></body></html>`

const sample = () =>
  form('Midterm', [
    choice('Pick one', ['a', 'b', 'c']),
    choice('Pick many', ['x', 'y'], { code: 4, required: false }),
    choice('Dropdown', ['d1', 'd2'], { code: 3 }),
    text('Short?', 0, true),
    text('Explain', 1),
  ], 'Read carefully')

describe('reading the pasted source', () => {
  const data = sample()
  it('accepts the whole page, the variable line, the bare array, and a parsed array', () => {
    const json = JSON.stringify(data)
    for (const input of [asPage(data), `var FB_PUBLIC_LOAD_DATA_ = ${json};`, json, data]) {
      expect(parseGoogleForm(input).questions).toHaveLength(5)
    }
  })

  it('survives brackets, quotes and script tags inside question text', () => {
    const tricky = form('T', [
      choice('What does ] mean? Say "hi" [ok] ;</script> done', ['one ]', 'two "q"']),
      text('Normal'),
    ])
    const parsed = parseGoogleForm(asPage(tricky))
    expect(parsed.questions[0].prompt).toBe('What does ] mean? Say "hi" [ok] ;</script> done')
    expect(parsed.questions[0].options).toEqual(['one ]', 'two "q"'])
    expect(parsed.questions).toHaveLength(2)
  })

  it('rejects empty, non-form and cut-off text with a readable message', () => {
    expect(() => extractFormData('')).toThrow(/Paste the Google Form page source/)
    expect(() => extractFormData('<html>hello</html>')).toThrow(/does not look like a Google Form/)
    expect(() => extractFormData(asPage(sample()).slice(0, 200))).toThrow(/cut off/)
    expect(() => extractFormData('var FB_PUBLIC_LOAD_DATA_ = [1, 2,;')).toThrow(ParseError)
    expect(() => parseGoogleForm([null, 'nope'])).toThrow(/Unexpected Google Form structure/)
  })
})

describe('one form', () => {
  it('maps types, required flags, options, title and description', () => {
    const p = parseGoogleForm(asPage(sample()))
    expect(p.title).toBe('Midterm')
    expect(p.description).toBe('Read carefully')
    expect(p.questions).toEqual([
      { type: 'multiple_choice', prompt: 'Pick one', required: true, options: ['a', 'b', 'c'] },
      { type: 'checkboxes', prompt: 'Pick many', required: false, options: ['x', 'y'] },
      { type: 'multiple_choice', prompt: 'Dropdown', required: true, options: ['d1', 'd2'] },
      { type: 'short_answer', prompt: 'Short?', required: true },
      { type: 'paragraph', prompt: 'Explain', required: false },
    ])
  })

  it('reports unsupported items instead of silently dropping them', () => {
    const f = form('F', [text('Header', 8), item('A grid', 7, field([opt('r1')], 0)), text('Real question'), item('', 11, null)])
    const p = parseGoogleForm(f)
    expect(p.questions.map((q) => q.prompt)).toEqual(['Real question'])
    expect(p.skipped).toEqual([
      { title: 'Header', reason: 'Unsupported item type (8)' },
      { title: 'A grid', reason: 'Unsupported item type (7)' },
    ])
  })

  it('warns when an option has no text (e.g. "Other")', () => {
    const p = parseGoogleForm(form('F', [choice('Pick', ['a', 'b', ''])]))
    expect(p.questions[0].options).toEqual(['a', 'b'])
    expect(p.warnings[0]).toMatch(/1 option\(s\) without text/)
  })

  it('fails with every problem listed when the form cannot be imported', () => {
    const f = form('F', [
      choice('Only one option', ['a']),
      choice('Dupes', ['a', 'a']),
      text('x'.repeat(2001)),
      text('   '),
    ])
    let error
    try { parseGoogleForm(f) } catch (e) { error = e }
    expect(error).toBeInstanceOf(ParseError)
    expect(error.problems).toEqual([
      'Question 1: needs at least 2 options.',
      'Question 2: has duplicate options.',
      'Question 3: text is longer than 2000 characters.',
      'Question 4: missing question text.',
    ])
  })

  it('a form with no supported questions is an error, not an empty exam', () => {
    expect(() => parseGoogleForm(form('F', [text('Header', 8)]))).toThrow(ParseError)
    expect(validateQuestions([])).toEqual(['The form has no supported questions.'])
  })
})

describe('several forms -> one exam', () => {
  const a = form('Part A', [choice('A1', ['1', '2']), text('A2')], 'first')
  const b = form('Part B', [text('B1', 1), choice('B2', ['x', 'y'], { code: 4 })])

  it('merges in order and summarises each form', () => {
    const p = parseGoogleForms([asPage(a), asPage(b)])
    expect(p.questions.map((q) => q.prompt)).toEqual(['A1', 'A2', 'B1', 'B2'])
    expect(p.title).toBe('Part A')
    expect(p.description).toBe('first')
    expect(p.forms).toEqual([
      { index: 1, title: 'Part A', questionCount: 2, skippedCount: 0 },
      { index: 2, title: 'Part B', questionCount: 2, skippedCount: 0 },
    ])
  })

  it('lets the admin override the title, ignores blank boxes, accepts a single form', () => {
    expect(parseGoogleForms([asPage(a), '   ', asPage(b)], { title: ' Final Exam ' }).title).toBe('Final Exam')
    expect(parseGoogleForms(asPage(a)).questions).toHaveLength(2)
  })

  it('tags skipped items with their form and warns about repeated questions', () => {
    const c = form('C', [text('Header', 8), text('A1')])
    const p = parseGoogleForms([asPage(a), asPage(c)])
    expect(p.skipped).toEqual([{ title: 'Header', reason: 'Unsupported item type (8)', form: 2 }])
    expect(p.warnings).toContain('Questions 1 and 3 have the same text.')
  })

  it('is all-or-nothing and names the form that is wrong', () => {
    const bad = form('Broken', [choice('One option', ['a'])])
    let error
    try { parseGoogleForms([asPage(a), asPage(bad), '<html>not a form</html>']) } catch (e) { error = e }
    expect(error).toBeInstanceOf(ParseError)
    expect(error.problems).toEqual([
      'Form 2 (Broken): Question 1: needs at least 2 options.',
      'Form 3: This does not look like a Google Form page. Open the form, choose "View page source", and copy everything.',
    ])
  })

  it('needs at least one form', () => {
    expect(() => parseGoogleForms([])).toThrow(/at least one Google Form/)
    expect(() => parseGoogleForms(['', '  '])).toThrow(/at least one Google Form/)
  })
})

describe('import payload (POST /api/exams/{exam}/questions)', () => {
  it('contains only the fields the backend accepts', () => {
    const p = parseGoogleForms([asPage(sample())])
    const { questions } = toImportPayload({ ...p, questions: p.questions.map((q) => ({ ...q, extra: 'x' })) })
    expect(questions).toHaveLength(5)
    for (const q of questions) {
      expect(Object.keys(q).every((k) => ['type', 'prompt', 'required', 'options'].includes(k))).toBe(true)
      expect(typeof q.required).toBe('boolean')
    }
    expect(questions[3]).not.toHaveProperty('options')
    expect(questions[0].options).toEqual(['a', 'b', 'c'])
  })
})

// Drop a real form's page source into tests/fixtures/real-form.txt and this runs by itself.
// (Open the Google Form > right-click > View page source > Select all > Copy > paste into that file.)
const realFile = path.resolve(process.cwd(), 'tests/fixtures/real-form.txt') // run `npm test` from the frontend folder
describe.skipIf(!fs.existsSync(realFile))('a REAL Google Form (tests/fixtures/real-form.txt)', () => {
  it('parses into valid backend questions', () => {
    const parsed = parseGoogleForm(fs.readFileSync(realFile, 'utf8'))
    console.log(`\nREAL FORM "${parsed.title}": ${parsed.questions.length} questions, ${parsed.skipped.length} skipped, ${parsed.warnings.length} warnings`)
    parsed.questions.forEach((q, i) => console.log(`  ${i + 1}. [${q.type}${q.required ? ', required' : ''}] ${q.prompt}${q.options ? '  -> ' + q.options.join(' | ') : ''}`))
    parsed.skipped.forEach((s) => console.log(`  skipped: ${s.title} (${s.reason})`))
    parsed.warnings.forEach((w) => console.log(`  warning: ${w}`))
    expect(parsed.questions.length).toBeGreaterThan(0)
    expect(validateQuestions(parsed.questions)).toEqual([])
  })
})