import { defineLoader } from 'vitepress'
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface BlogPost {
  title: string
  date: string
  description: string
  tags: string[]
  slug: string
  url: string
}

export declare const data: BlogPost[]

function parseFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return null
  const meta: Record<string, unknown> = {}
  const lines = match[1].split(/\r?\n/)
  let currentKey = ''
  for (const line of lines) {
    const kv = line.match(/^([\w][\w-]*):\s*(.*)/)
    if (kv) {
      currentKey = kv[1]
      const val = kv[2].replace(/^["']|["']$/g, '').trim()
      if (val) {
        meta[currentKey] = val
      } else {
        meta[currentKey] = []
      }
    } else if (currentKey && line.match(/^\s+- (.*)/)) {
      const arr = meta[currentKey]
      if (Array.isArray(arr)) {
        arr.push(line.match(/^\s+- (.*)/)![1].replace(/^["']|["']$/g, '').trim())
      }
    }
  }
  return meta
}

export default defineLoader({
  load(): BlogPost[] {
    const blogDir = join(__dirname, '..', '..', 'blog', 'releases')
    const posts: BlogPost[] = []

    let files: string[]
    try {
      files = readdirSync(blogDir).filter(f => f.endsWith('.md'))
    } catch {
      return []
    }

    for (const file of files) {
      const content = readFileSync(join(blogDir, file), 'utf-8')
      const meta = parseFrontmatter(content)
      if (!meta) continue

      const slug = file.replace(/\.md$/, '')
      posts.push({
        title: String(meta.title || slug),
        date: String(meta.date || ''),
        description: String(meta.description || ''),
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        slug,
        url: `/blog/releases/${slug}`,
      })
    }

    posts.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    return posts
  },
})
