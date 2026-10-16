'use client'

import { useState } from 'react'
import type { GeneratedContent } from '@/lib/ai/content-schema'
import { postVisualCopy } from '@/lib/post-visual-copy'
import ImageStudio from './image-studio'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export default function OutputWorkspace({
  outputs, onChange, title, onTitleChange, onSave, saving, saveNotice, generationId, imageGenerationEnabled, postDesignEnabled, onPostImageSelected,
}: {
  outputs: GeneratedContent
  onChange: (outputs: GeneratedContent) => void
  title: string
  onTitleChange: (title: string) => void
  onSave: () => void
  saving: boolean
  saveNotice: string | null
  generationId: string | null
  imageGenerationEnabled: boolean
  postDesignEnabled: boolean
  onPostImageSelected: (url: string | null) => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setCopyError(null)
    } catch {
      setCopyError('Clipboard access failed. Select the text and copy it manually.')
    }
  }

  function exportMarkdown() {
    const visual = postVisualCopy(outputs)
    const markdown = [
      '# ' + title,
      '## LinkedIn', outputs.linkedin,
      ...(outputs.facebook_post ? ['## Facebook Page', outputs.facebook_post] : []),
      '## X thread', ...outputs.twitter_thread.map((tweet, index) => String(index + 1) + '. ' + tweet),
      '## Instagram', outputs.instagram_caption,
      outputs.instagram_hashtags.map((tag) => '#' + tag).join(' '),
      ...(outputs.image_prompt ? ['## Visual direction', outputs.image_prompt] : []),
      '## Visual copy',
      visual.headline,
      visual.kicker,
      visual.body,
    ].join('\n\n')
    download('orbact-draft.md', markdown, 'text/markdown;charset=utf-8')
  }

  const fieldClass = 'input-field resize-y min-h-28 leading-relaxed'
  return (
    <section id="workspace" className="space-y-5 scroll-mt-8">
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Edit & export</p>
            <label htmlFor="draft-title" className="block text-sm text-muted mb-2">Draft title</label>
            <input id="draft-title" value={title} maxLength={200} onChange={(event) => onTitleChange(event.target.value)} className="input-field font-semibold" />
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#calendar" className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200">Review & publish ↗</a>
            <button type="button" onClick={exportMarkdown} className="btn-secondary text-sm">Export .md</button>
            <button type="button" onClick={() => download('orbact-draft.json', JSON.stringify({ title, outputs }, null, 2), 'application/json')} className="btn-secondary text-sm">Export JSON</button>
            {generationId && <button type="button" disabled={saving} onClick={onSave} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save edits'}</button>}
          </div>
        </div>
        {saveNotice && <p role="status" className="text-sm text-muted mt-3">{saveNotice}</p>}
        {copyError && <p role="alert" className="text-sm text-danger mt-3">{copyError}</p>}
        <p className="text-xs text-muted mt-3">Review facts and claims before publishing. Edits are saved only when you select Save edits.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">LinkedIn</h3>
            <button type="button" onClick={() => copy('linkedin', outputs.linkedin)} className="btn-secondary text-xs">{copied === 'linkedin' ? 'Copied' : 'Copy'}</button>
          </div>
          <label htmlFor="linkedin-output" className="sr-only">LinkedIn post</label>
          <textarea id="linkedin-output" value={outputs.linkedin} onChange={(event) => onChange({ ...outputs, linkedin: event.target.value })} rows={12} className={fieldClass} />
          <p className="text-xs text-muted mt-2">{outputs.linkedin.length} characters</p>
        </article>

        <article className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">X thread</h3>
            <button type="button" onClick={() => copy('thread', outputs.twitter_thread.join('\n\n'))} className="btn-secondary text-xs">{copied === 'thread' ? 'Copied' : 'Copy thread'}</button>
          </div>
          <div className="space-y-3">
            {outputs.twitter_thread.map((tweet, index) => (
              <div key={index}>
                <label htmlFor={'tweet-' + index} className="text-xs text-muted">Post {index + 1}</label>
                <textarea id={'tweet-' + index} value={tweet} rows={3} onChange={(event) => {
                  const tweets = [...outputs.twitter_thread]
                  tweets[index] = event.target.value
                  onChange({ ...outputs, twitter_thread: tweets })
                }} className="input-field resize-y" />
                <p className={'text-xs mt-1 ' + (tweet.length > 280 ? 'text-danger' : 'text-muted')}>{tweet.length}/280</p>
              </div>
            ))}
          </div>
        </article>

        {outputs.facebook_post !== undefined && <article className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Facebook Page</h3>
            <button type="button" onClick={() => copy('facebook', outputs.facebook_post || '')} className="btn-secondary text-xs">{copied === 'facebook' ? 'Copied' : 'Copy'}</button>
          </div>
          <label htmlFor="facebook-output" className="sr-only">Facebook Page post</label>
          <textarea id="facebook-output" value={outputs.facebook_post} onChange={(event) => onChange({ ...outputs, facebook_post: event.target.value })} rows={7} className={fieldClass} />
          <p className="text-xs text-muted mt-2">{outputs.facebook_post.length} characters</p>
        </article>}

        <article className="glass-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Instagram</h3>
            <button type="button" onClick={() => copy('instagram', outputs.instagram_caption + '\n\n' + outputs.instagram_hashtags.map((tag) => '#' + tag).join(' '))} className="btn-secondary text-xs">{copied === 'instagram' ? 'Copied' : 'Copy caption'}</button>
          </div>
          <label htmlFor="instagram-output" className="text-sm text-muted">Caption</label>
          <textarea id="instagram-output" value={outputs.instagram_caption} rows={7} onChange={(event) => onChange({ ...outputs, instagram_caption: event.target.value })} className={fieldClass} />
          <p className={'text-xs mt-1 ' + (outputs.instagram_caption.length > 2200 ? 'text-danger' : 'text-muted')}>{outputs.instagram_caption.length}/2200</p>
          <label htmlFor="instagram-tags" className="block text-sm text-muted mt-4 mb-2">Hashtags (comma-separated)</label>
          <input id="instagram-tags" className="input-field" value={outputs.instagram_hashtags.join(', ')} onChange={(event) => onChange({
            ...outputs,
            instagram_hashtags: event.target.value.split(',').map((tag) => tag.trim().replace(/^#/, '')),
          })} />
        </article>
      </div>

      <ImageStudio key={generationId ?? 'draft'} outputs={outputs} aiEnabled={imageGenerationEnabled} designEnabled={postDesignEnabled} onSelectImage={onPostImageSelected} />
    </section>
  )
}
