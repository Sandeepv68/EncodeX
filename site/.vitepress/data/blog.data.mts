import { defineLoader } from 'vitepress'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
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
  locale: string
}

export declare const data: BlogPost[]

const LOCALES = ['es', 'fr', 'de', 'pt', 'zh', 'hi']

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

function loadPostsFromDir(dir: string, urlPrefix: string, locale: string): BlogPost[] {
  const posts: BlogPost[] = []
  if (!existsSync(dir)) return posts

  let files: string[]
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.md'))
  } catch {
    return posts
  }

  for (const file of files) {
    const content = readFileSync(join(dir, file), 'utf-8')
    const meta = parseFrontmatter(content)
    if (!meta) continue

    const slug = file.replace(/\.md$/, '')
    posts.push({
      title: String(meta.title || slug),
      date: String(meta.date || ''),
      description: String(meta.description || ''),
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      slug,
      url: `${urlPrefix}/blog/releases/${slug}`,
      locale,
    })
  }

  return posts
}

export default defineLoader({
  load(): BlogPost[] {
    const siteDir = join(__dirname, '..', '..')

    const posts: BlogPost[] = loadPostsFromDir(
      join(siteDir, 'blog', 'releases'),
      '',
      'en',
    )

    for (const locale of LOCALES) {
      const localeDir = join(siteDir, 'locales', locale, 'blog', 'releases')
      posts.push(...loadPostsFromDir(localeDir, `/${locale}`, locale))
    }

    posts.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    return posts
  },
})
