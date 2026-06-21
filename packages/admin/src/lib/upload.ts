import { callFunction, getStoredAdminToken } from './cloudbase'

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024
const DEFAULT_MAX_WIDTH = 1200
const DEFAULT_MAX_HEIGHT = 1200
const DEFAULT_QUALITY = 0.85
const MIN_QUALITY = 0.45
const MAX_FUNCTION_UPLOAD_FILE_SIZE = 480 * 1024

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
  options: { maxWidth?: number; maxHeight?: number; quality?: number; outputType?: string } = {},
): Promise<File> {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH
  const maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT
  const quality = options.quality || DEFAULT_QUALITY
  const outputType = options.outputType || (file.type === 'image/webp' ? 'image/jpeg' : file.type)

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

  if (outputType === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, outputType, quality)
  const ext = outputType === 'image/png' ? 'png' : 'jpg'
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image'
  return new File([blob], `${name}.${ext}`, { type: outputType })
}

async function compressImageToFit(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number; maxSize: number; outputType?: string },
): Promise<File> {
  let maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH
  let maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT
  let quality = options.quality || DEFAULT_QUALITY
  let compressed = await compressImage(file, { maxWidth, maxHeight, quality, outputType: options.outputType })

  while (compressed.size > options.maxSize && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.12)
    compressed = await compressImage(file, { maxWidth, maxHeight, quality, outputType: options.outputType })
  }

  while (compressed.size > options.maxSize && (maxWidth > 480 || maxHeight > 480)) {
    maxWidth = Math.max(480, Math.floor(maxWidth * 0.8))
    maxHeight = Math.max(480, Math.floor(maxHeight * 0.8))
    compressed = await compressImage(file, {
      maxWidth,
      maxHeight,
      quality: MIN_QUALITY,
      outputType: options.outputType,
    })
  }

  return compressed
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
    outputType?: string
  } = {},
): Promise<string> {
  const allowedTypes = options.allowedTypes || new Set(['image/jpeg', 'image/png', 'image/webp'])
  const maxSize = options.maxSize || MAX_UPLOAD_SIZE
  const payloadSafeMaxSize = Math.min(maxSize, MAX_FUNCTION_UPLOAD_FILE_SIZE)

  if (!allowedTypes.has(file.type)) {
    throw new Error('不支持的文件格式')
  }

  let uploadFile = file
  if (options.compress !== false) {
    uploadFile = await compressImageToFit(file, {
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      quality: options.quality,
      maxSize: payloadSafeMaxSize,
      outputType: options.outputType,
    })
  }

  if (uploadFile.size > payloadSafeMaxSize) {
    throw new Error(`图片压缩后仍超过 ${Math.ceil(payloadSafeMaxSize / 1024)}KB，请更换更小的图片`)
  }
  if (!cloudPath || typeof cloudPath !== 'string') {
    throw new Error('缺少上传路径')
  }

  const ext = uploadFile.type === 'image/png' ? 'png' : uploadFile.type === 'image/webp' ? 'webp' : 'jpg'
  const finalCloudPath = cloudPath.replace(/\.[^.]+$/, `.${ext}`)

  const base64Data = await fileToBase64(uploadFile)
  let result: { success?: boolean; error?: string; data?: { fileID: string; cloudPath: string } }
  try {
    result = await callFunction<{ success?: boolean; error?: string; data?: { fileID: string; cloudPath: string } }>(
      'adminUpload',
      {
        token: getStoredAdminToken(),
        cloudPath: finalCloudPath,
        base64Data,
        mimeType: uploadFile.type,
        size: uploadFile.size,
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (
      message.includes('EXCEED_MAX_PAYLOAD_SIZE') ||
      message.includes('Payload Too Large') ||
      message.includes('413')
    ) {
      throw new Error('图片上传数据过大，请选择更小的图片或先压缩后再上传')
    }
    throw error
  }

  if (!result.success) {
    throw new Error(result.error || '上传失败')
  }

  return result.data?.cloudPath || finalCloudPath
}
