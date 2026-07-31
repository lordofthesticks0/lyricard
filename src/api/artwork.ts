export function upscaleArtwork(url: string, size = 1200): string {
  return url.replace(/\d+x\d+bb\.(jpg|png)/, `${size}x${size}bb.$1`)
}

export async function fetchArtworkAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' })
  if (!response.ok) {
    throw new Error(`Failed to fetch artwork: ${response.status}`)
  }
  const blob = await response.blob()

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
