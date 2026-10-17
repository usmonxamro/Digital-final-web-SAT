'use client'

import { Math, MixedText } from '@/components/math'
import type { Choice } from '@/lib/test-data'

/** The picture of an answer option (a diagram / graph used as choice A–D). */
export function ChoiceImage({ src, size = 'md', dim }: { src: string; size?: 'sm' | 'md'; dim?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Javob varianti rasmi"
      draggable={false}
      className={`block max-w-full select-none object-contain ${
        size === 'sm' ? 'max-h-16' : 'max-h-44 sm:max-h-52'
      } ${dim ? 'opacity-40' : ''}`}
    />
  )
}

/** What is written inside an answer option: its picture (if any) above its text / formula (if any). */
export function ChoiceContent({ choice, size = 'md', dim }: { choice: Choice; size?: 'sm' | 'md'; dim?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-1.5">
      {choice.image && <ChoiceImage src={choice.image} size={size} dim={dim} />}
      {choice.tex ? <Math tex={choice.tex} /> : choice.text ? <MixedText text={choice.text} /> : null}
    </span>
  )
}
