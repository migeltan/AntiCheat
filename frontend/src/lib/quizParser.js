// Google Form(s) -> AntiCheat question format.
// Pure functions, no React. Output matches POST /api/exams/{exam}/questions:
//   { questions: [{ type, prompt, options?, required }] }
// Presentation code never sees raw Google Form data.
//
// Input: the page source of a public Google Form (it contains FB_PUBLIC_LOAD_DATA_),
// just that line, the bare JSON array, or an already-parsed array. A browser cannot
// fetch docs.google.com itself (CORS), so the text has to be pasted in or supplied by
// a backend endpoint.
//
//   parseGoogleForm(input)            one form  -> { title, description, questions, skipped, warnings }
//   parseGoogleForms([a, b, ...])     several   -> same, merged in order, plus `forms` per-form summary
//   toImportPayload(parsed)           body for POST /api/exams/{exam}/questions

export const QUESTION_TYPES = ['multiple_choice', 'checkboxes', 'short_answer', 'paragraph']
const CHOICE_TYPES = ['multiple_choice', 'checkboxes']

// Google's internal item type ids (FB_PUBLIC_LOAD_DATA_). Anything else
// (grid, scale, date, file upload, section headers...) is skipped and reported.
const GOOGLE_TYPES = {
  0: 'short_answer',
  1: 'paragraph',
  2: 'multiple_choice',
  3: 'multiple_choice', // dropdown = single choice
  4: 'checkboxes',
}

const MARKER = 'FB_PUBLIC_LOAD_DATA_'
const clean = (v) => (v ?? '').toString().trim()

export class ParseError extends Error {
  constructor(message, problems = []) {
    super(message)
    this.name = 'ParseError'
    this.problems = problems
  }
}

// ---------- reading the pasted source ----------

// Returns the first complete [...] array that starts at text[start]. Brackets and
// quotes inside strings are ignored, so a question like: What does ] mean? is safe.
function sliceArray(text, start) {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null // never closed
}

// Accepts the whole page HTML, the `var FB_PUBLIC_LOAD_DATA_ = [...];` line, or the bare array text.
export function extractFormData(text) {
  if (typeof text !== 'string' || !text.trim()) throw new ParseError('Paste the Google Form page source first.')
  const src = text.trim()

  let start = -1
  const at = src.indexOf(MARKER)
  if (at !== -1) {
    const eq = src.indexOf('=', at)
    start = eq === -1 ? -1 : src.indexOf('[', eq)
  } else if (src.startsWith('[')) {
    start = 0
  }
  if (start === -1) {
    throw new ParseError('This does not look like a Google Form page. Open the form, choose "View page source", and copy everything.')
  }

  const raw = sliceArray(src, start)
  if (!raw) throw new ParseError('The pasted text is cut off. Copy the whole page source and try again.')
  try {
    return JSON.parse(raw)
  } catch {
    throw new ParseError('Could not read the Google Form data.')
  }
}

const readSource = (input) => (Array.isArray(input) ? input : extractFormData(input))

// ---------- validation (mirrors the backend's import rules) ----------

// Checks questions against QuestionController::import. Returns a list of problems.
export function validateQuestions(questions) {
  const problems = []
  if (!Array.isArray(questions) || questions.length === 0) {
    return ['The form has no supported questions.']
  }
  questions.forEach((q, i) => {
    const n = i + 1
    if (!QUESTION_TYPES.includes(q.type)) problems.push(`Question ${n}: unsupported type "${q.type}".`)
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) problems.push(`Question ${n}: missing question text.`)
    else if (q.prompt.length > 2000) problems.push(`Question ${n}: text is longer than 2000 characters.`)
    if (CHOICE_TYPES.includes(q.type)) {
      const opts = q.options ?? []
      if (opts.length < 2) problems.push(`Question ${n}: needs at least 2 options.`)
      if (opts.some((o) => typeof o !== 'string' || !o.trim() || o.length > 500))
        problems.push(`Question ${n}: has an empty or too-long option.`)
      if (new Set(opts).size !== opts.length) problems.push(`Question ${n}: has duplicate options.`)
    }
  })
  return problems
}

// ---------- one form ----------

// Converts one form WITHOUT validating, so several forms can be checked together.
function convertForm(input) {
  const data = readSource(input)
  const items = data?.[1]?.[1]
  if (!Array.isArray(items)) throw new ParseError('Unexpected Google Form structure.')

  const questions = []
  const skipped = []
  const warnings = []
  for (const item of items) {
    const title = clean(item?.[1])
    const code = item?.[3]
    const type = GOOGLE_TYPES[code]
    const field = item?.[4]?.[0]
    if (!type || !field) {
      if (title) skipped.push({ title, reason: `Unsupported item type (${code ?? 'unknown'})` }) // section header, grid, date, etc.
      continue
    }
    const q = { type, prompt: title, required: Boolean(field[2]) }
    if (CHOICE_TYPES.includes(type)) {
      const raw = Array.isArray(field[1]) ? field[1] : []
      q.options = raw.map((o) => clean(o?.[0])).filter(Boolean)
      const dropped = raw.length - q.options.length
      if (dropped > 0) {
        warnings.push(`"${title}": ${dropped} option(s) without text were left out (for example an "Other" option).`)
      }
    }
    questions.push(q)
  }

  return {
    title: clean(data?.[1]?.[8] ?? data?.[3]),
    description: clean(data?.[1]?.[0]),
    questions,
    skipped,
    warnings,
  }
}

// Parses one form. Throws ParseError (with .problems) if it cannot be imported.
export function parseGoogleForm(input) {
  const form = convertForm(input)
  const problems = validateQuestions(form.questions)
  if (problems.length) throw new ParseError('The form could not be converted.', problems)
  return form
}

// ---------- several forms -> one exam ----------

// All-or-nothing: if ANY form has a problem nothing is returned, because a quietly missing
// section would ruin an exam. Every problem is listed with its form number.
// options.title overrides the exam title (default: the first form's title).
export function parseGoogleForms(inputs, options = {}) {
  const list = (Array.isArray(inputs) ? inputs : [inputs]).filter(
    (x) => x != null && !(typeof x === 'string' && !x.trim()),
  )
  if (list.length === 0) throw new ParseError('Add at least one Google Form.')

  const forms = []
  const problems = []
  list.forEach((input, i) => {
    const label = `Form ${i + 1}`
    try {
      const form = convertForm(input)
      const name = form.title ? ` (${form.title})` : ''
      validateQuestions(form.questions).forEach((m) => problems.push(`${label}${name}: ${m}`))
      forms.push(form)
    } catch (err) {
      if (!(err instanceof ParseError)) throw err
      problems.push(`${label}: ${err.message}`)
    }
  })
  if (problems.length) throw new ParseError('The forms could not be combined.', problems)

  const questions = forms.flatMap((f) => f.questions)
  const warnings = forms.flatMap((f, i) => f.warnings.map((w) => `Form ${i + 1}: ${w}`))

  // Same text twice is allowed (it may be intended) but worth telling the admin about.
  const seen = new Map()
  questions.forEach((q, i) => {
    const key = q.prompt.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) warnings.push(`Questions ${seen.get(key) + 1} and ${i + 1} have the same text.`)
    else seen.set(key, i)
  })

  return {
    title: clean(options.title) || forms[0].title,
    description: forms.map((f) => f.description).find(Boolean) ?? '',
    questions,
    skipped: forms.flatMap((f, i) => f.skipped.map((s) => ({ ...s, form: i + 1 }))),
    warnings,
    forms: forms.map((f, i) => ({
      index: i + 1,
      title: f.title,
      questionCount: f.questions.length,
      skippedCount: f.skipped.length,
    })),
  }
}

// Body for POST /api/exams/{exam}/questions (only the fields the backend accepts).
export const toImportPayload = (parsed) => ({
  questions: parsed.questions.map(({ type, prompt, options, required }) => ({
    type,
    prompt,
    required,
    ...(CHOICE_TYPES.includes(type) ? { options } : {}),
  })),
})