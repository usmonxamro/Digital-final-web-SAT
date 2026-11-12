export type Lang = 'uz' | 'en'
export type Prep = 'none' | 'little' | 'mid' | 'good'
export const PREPS: Prep[] = ['none', 'little', 'mid', 'good']

export interface DarajaChoice { id: string; text?: string; tex?: string }
export interface DarajaQuestion {
  module: 1 | 2
  n: number
  type: 'mcq' | 'gridin'
  difficulty: string
  domain: string
  prompt: string
  equations?: string[]
  choices?: DarajaChoice[]
  image?: string
  satFormat?: boolean
}
