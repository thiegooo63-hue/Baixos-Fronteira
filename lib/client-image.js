export async function compressImageFile(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = {}) {
  if (!file || file.type === 'image/gif') return file
  if (!file.type?.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Falha ao comprimir imagem.')), 'image/webp', quality)
  })
  const base = (file.name || 'imagem').replace(/\.[^.]+$/, '')
  return new File([blob], `${base}.webp`, { type: 'image/webp', lastModified: Date.now() })
}
