// Google Form -> AntiCheat question format.
// Pure functions, no React. Output matches POST /api/exams/{exam}/questions:
//   { questions: [{ type, prompt, options?, required }] }
// Presentation code never sees raw Google Form data.

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

export class ParseError extends Error {
  constructor(message, problems = []) {
    super(message)
    this.name = 'ParseError'
    this.problems = problems
  }
}

// Pulls the FB_PUBLIC_LOAD_DATA_ array out of a public Google Form's HTML.
export function extractFormData(html) {
  const m = /FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/.exec(html)
  if (!m) throw new ParseError('This does not look like a Google Form page.')
  try {
    return JSON.parse(m[1])
  } catch {
    throw new ParseError('Could not read the Google Form data.')
  }
}

// Checks questions against the backend's import rules. Returns a list of problems.
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

// Parses the FB_PUBLIC_LOAD_DATA_ array (or the page HTML containing it).
export function parseGoogleForm(input) {
  const data = typeof input === 'string' ? extractFormData(input) : input
  const items = data?.[1]?.[1]
  if (!Array.isArray(items)) throw new ParseError('Unexpected Google Form structure.')

  const questions = []
  const skipped = []
  for (const item of items) {
    const title = (item?.[1] ?? '').toString().trim()
    const type = GOOGLE_TYPES[item?.[3]]
    const field = item?.[4]?.[0]
    if (!type || !field) {
      if (title) skipped.push(title) // section header, grid, date, etc.
      continue
    }
    const q = { type, prompt: title, required: Boolean(field[2]) }
    if (CHOICE_TYPES.includes(type)) {
      q.options = (field[1] ?? []).map((o) => (o?.[0] ?? '').toString().trim()).filter(Boolean)
    }
    questions.push(q)
  }

  const problems = validateQuestions(questions)
  if (problems.length) throw new ParseError('The form could not be converted.', problems)

  return {
    title: (data?.[1]?.[8] ?? data?.[3] ?? '').toString().trim(),
    description: (data?.[1]?.[0] ?? '').toString().trim(),
    questions,
    skipped,
  }
}

// Body for POST /api/exams/{exam}/questions
export const toImportPayload = (parsed) => ({ questions: parsed.questions })