import type { LyricLine } from '../types'

export function useLyricFontTier(selectedLines: LyricLine[]): 'large' | 'medium' | 'small' {
  const totalChars = selectedLines.reduce((sum, line) => sum + line.text.length, 0)
  if (totalChars <= 90) return 'large'
  if (totalChars <= 180) return 'medium'
  return 'small'
}
