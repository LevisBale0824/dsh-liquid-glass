import { readFile } from 'node:fs/promises'

function parseAttrs(raw) {
  const attrs = {}
  const pattern = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let match
  while ((match = pattern.exec(raw)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attrs
}

export function parseHtml(html) {
  const root = { tag: '#document', attrs: {}, children: [], parent: null }
  const stack = [root]
  const tokens = html.split(/(<[^>]+>)/g).filter(part => part !== '')
  for (const token of tokens) {
    if (token.startsWith('<!') || token.startsWith('<?')) continue
    if (token.startsWith('</')) {
      stack.pop()
      continue
    }
    if (token.startsWith('<')) {
      const selfClosing = /\/>$/.test(token)
      const body = token.replace(/^<\/?/, '').replace(/\/?>$/, '')
      const space = body.indexOf(' ')
      const tag = (space === -1 ? body : body.slice(0, space)).toLowerCase()
      const attrs = parseAttrs(space === -1 ? '' : body.slice(space + 1))
      const node = { tag, attrs, children: [], parent: stack[stack.length - 1] }
      stack[stack.length - 1].children.push(node)
      const voidTags = new Set(['br', 'img', 'input', 'meta', 'link', 'hr'])
      if (!selfClosing && !voidTags.has(tag)) stack.push(node)
      continue
    }
    stack[stack.length - 1].children.push({
      tag: '#text',
      attrs: {},
      children: [],
      parent: stack[stack.length - 1],
      text: token,
    })
  }
  return root
}

function isElement(node) {
  return node && node.tag !== '#text' && node.tag !== '#document'
}

function childrenOf(node) {
  return (node.children || []).filter(isElement)
}

function attr(node, name) {
  return node.attrs?.[name]
}

function hasAttr(node, name) {
  return Object.prototype.hasOwnProperty.call(node.attrs || {}, name)
}

function walk(node, visit) {
  if (isElement(node) || node.tag === '#document') visit(node)
  for (const child of node.children || []) walk(child, visit)
}

function matchSimple(node, part) {
  if (!isElement(node)) return false
  if (part.tag && node.tag !== part.tag) return false
  for (const test of part.attrs) {
    if (test.op === 'exists' && !hasAttr(node, test.name)) return false
    if (test.op === '=' && attr(node, test.name) !== test.value) return false
  }
  for (const not of part.nots || []) {
    if (matchSimple(node, not)) return false
  }
  if (part.pseudo.includes('first-child')) {
    const siblings = childrenOf(node.parent)
    if (siblings[0] !== node) return false
  }
  if (part.pseudo.includes('last-child')) {
    const siblings = childrenOf(node.parent)
    if (siblings[siblings.length - 1] !== node) return false
  }
  for (const has of part.has) {
    if (has.direct) {
      if (!childrenOf(node).some(child => matchSimple(child, has.inner))) return false
    } else if (queryAll(node, [has.inner]).length === 0) return false
  }
  return true
}

function parsePart(raw) {
  const part = { tag: null, attrs: [], pseudo: [], has: [], nots: [] }
  let rest = raw.trim()
  const hasMatch = rest.match(/:has\((.+)\)$/)
  if (hasMatch) {
    const innerRaw = hasMatch[1].trim()
    const direct = innerRaw.startsWith('>')
    part.has.push({
      direct,
      inner: parsePart(direct ? innerRaw.slice(1).trim() : innerRaw),
    })
    rest = rest.slice(0, hasMatch.index)
  }
  rest = rest.replace(/:not\(([^)]+)\)/g, (_, inner) => {
    part.nots.push(parsePart(inner))
    return ''
  })
  rest = rest.replace(/:(first-child|last-child)/g, (_, name) => {
    part.pseudo.push(name)
    return ''
  })
  const tagMatch = rest.match(/^([a-z][\w-]*)/i)
  if (tagMatch) {
    part.tag = tagMatch[1].toLowerCase()
    rest = rest.slice(tagMatch[0].length)
  }
  const attrPattern = /\[([^\]]+)\]/g
  let match
  while ((match = attrPattern.exec(rest)) !== null) {
    const body = match[1]
    const eq = body.indexOf('=')
    if (eq === -1) part.attrs.push({ name: body, op: 'exists' })
    else {
      part.attrs.push({
        name: body.slice(0, eq),
        op: '=',
        value: body.slice(eq + 1).replace(/^["']|["']$/g, ''),
      })
    }
  }
  return part
}

function tokenizeSelector(selector) {
  const tokens = []
  let current = ''
  let depth = 0
  for (const ch of selector.trim()) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (depth === 0 && ch === '>') {
      if (current.trim()) tokens.push(current.trim())
      tokens.push('>')
      current = ''
      continue
    }
    if (depth === 0 && /\s/.test(ch)) {
      if (current.trim()) tokens.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) tokens.push(current.trim())
  return tokens
}

function parseSelector(selector) {
  const tokens = tokenizeSelector(selector)
  return tokens
    .map((token, index, all) => {
      if (token === '>') return { combinator: '>' }
      return { combinator: index > 0 && all[index - 1] === '>' ? '>' : ' ', part: parsePart(token) }
    })
    .filter(item => item.part)
}

function queryAll(root, parsed) {
  const parts = Array.isArray(parsed) ? parsed : parseSelector(parsed)
  let current = [root]
  for (let index = 0; index < parts.length; index += 1) {
    const step = parts[index]
    const next = []
    const from = index === 0 && step.combinator !== '>' ? (() => {
      const all = []
      walk(root, node => { if (isElement(node)) all.push(node) })
      return all
    })() : current
    if (index === 0 && step.combinator !== '>') {
      for (const node of from) {
        if (matchSimple(node, step.part)) next.push(node)
      }
    } else if (step.combinator === '>') {
      for (const node of current) {
        for (const child of childrenOf(node)) {
          if (matchSimple(child, step.part)) next.push(child)
        }
      }
    } else {
      for (const node of current) {
        walk(node, child => {
          if (child !== node && isElement(child) && matchSimple(child, step.part)) next.push(child)
        })
      }
    }
    current = [...new Set(next)]
  }
  return current
}

export async function loadFixture(name = 'dsh-47f943859b.html') {
  const html = await readFile(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
  return parseHtml(html)
}

export function select(root, selector) {
  return queryAll(root, selector)
}
