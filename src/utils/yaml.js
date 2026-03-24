// More robust YAML front matter regex
// Matches --- at start, content, and --- at end (with optional trailing newline)
const YAML_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function extractYAML(content) {
  const match = content.match(YAML_REGEX)
  if (match) {
    return {
      yaml: match[0].trimEnd(),
      yamlContent: match[1],
      body: content.slice(match[0].length).trim(),
      hasYAML: true
    }
  }
  return {
    yaml: '',
    yamlContent: '',
    body: content,
    hasYAML: false
  }
}

export function replaceYAML(content, newYAML) {
  const { hasYAML } = extractYAML(content)
  if (hasYAML) {
    return content.replace(YAML_REGEX, newYAML)
  }
  return `${newYAML}\n\n${content}`
}

export function parseYAML(yamlString) {
  const result = {}
  const lines = yamlString.split('\n')

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/)
    if (match) {
      const [, key, value] = match
      result[key] = value.trim()
    }
  }

  return result
}

export function stringifyYAML(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
}

export function getYAMLField(content, field) {
  const { yamlContent, hasYAML } = extractYAML(content)
  if (!hasYAML) return null

  const parsed = parseYAML(yamlContent)
  return parsed[field] || null
}

export function setYAMLField(content, field, value) {
  const { yamlContent, hasYAML } = extractYAML(content)
  if (!hasYAML) {
    const newYAML = `---\n${field}: ${value}\n---`
    return `${newYAML}\n\n${content}`
  }

  const parsed = parseYAML(yamlContent)
  parsed[field] = value
  const newYAML = `---\n${stringifyYAML(parsed)}\n---`
  return replaceYAML(content, newYAML)
}
