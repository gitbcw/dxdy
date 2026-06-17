import { callFunction, getStoredAdminToken } from './cloudbase'

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024
const DEFAULT_MAX_WIDTH = 1200
const DEFAULT_MAX_HEIGHT = 1200
const DEFAULT_QUALITY = 0.85

function readImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('图片压缩失败'))
      },
      mimeType,
      quality,
    )
  })
}

async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {},
): Promise<File> {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH
  const maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT
  const quality = options.quality || DEFAULT_QUALITY

  // WebP/PNG 转 JPEG 以获得更好压缩；JPEG 保持原格式
  const outputType = file.type === 'image/webp' ? 'image/jpeg' : file.type

  const img = await readImageFile(file)
  let { width, height } = img

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.floor(width * ratio)
    height = Math.floor(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('创建画布失败')
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, outputType, quality)
  const ext = outputType === 'image/png' ? 'png' : 'jpg'
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image'
  return new File([blob], `${name}.${ext}`, { type: outputType })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] || result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

export async function uploadFileToCloudBase(
  file: File,
  cloudPath: string,
  options: {
    allowedTypes?: Set<string>
    maxSize?: number
    compress?: boolean
    maxWidth?: number
    maxHeight?: number
    quality?: number
  } = {},
): Promise<string> {
  const allowedTypes = options.allowedTypes || new Set(['image/jpeg', 'image/png', 'image/webp'])
  const maxSize = options.maxSize || MAX_UPLOAD_SIZE

  if (!allowedTypes.has(file.type)) {
    throw new Error('不支持的文件格式')
  }

  let uploadFile = file
  if (options.compress !== false) {
    uploadFile = await compressImage(file, {
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      quality: options.quality,
    })
  }

  if (uploadFile.size > maxSize) {
    throw new Error(`文件大小不能超过 ${Math.floor(maxSize / 1024 / 1024)}MB`)
  }
  if (!cloudPath || typeof cloudPath !== 'string') {
    throw new Error('缺少上传路径')
  }

  const ext = uploadFile.type === 'image/png' ? 'png' : uploadFile.type === 'image/webp' ? 'webp' : 'jpg'
  const finalCloudPath = cloudPath.replace(/\.[^.]+$/, `.${ext}`)

  const base64Data = await fileToBase64(uploadFile)
  const result = await callFunction<{ success?: boolean; error?: string; data?: { fileID: string; cloudPath: string } }>('adminUpload', {
    token: getStoredAdminToken(),
    cloudPath: finalCloudPath,
    base64Data,
    mimeType: uploadFile.type,
    size: uploadFile.size,
  })

  if (!result.success) {
    throw new Error(result.error || '上传失败')
  }

  return result.data?.cloudPath || finalCloudPath
}
