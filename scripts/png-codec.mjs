import { deflateSync, inflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBuf, data, crc])
}

export function encodePngRgba(width, height, data) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const dest = y * (width * 4 + 1)
    raw[dest] = 0
    raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), dest + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = deflateSync(raw, { level: 9, windowBits: 15, memLevel: 8 })
  const png = Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return 'data:image/png;base64,' + png.toString('base64')
}

export function decodePngDataUrl(url) {
  const base64 = String(url).replace(/^data:image\/png;base64,/, '')
  const png = Buffer.from(base64, 'base64')
  if (png.subarray(0, 8).compare(SIGNATURE) !== 0) throw new Error('bad png signature')
  let offset = 8
  let width = 0
  let height = 0
  const idat = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('latin1')
    const data = png.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  const raw = inflateSync(Buffer.concat(idat))
  const pixels = new Uint8ClampedArray(width * height * 4)
  const stride = width * 4 + 1
  for (let y = 0; y < height; y++) {
    pixels.set(raw.subarray(y * stride + 1, y * stride + 1 + width * 4), y * width * 4)
  }
  return { width, height, data: pixels }
}

export function hashPixels(data) {
  return createHash('sha256').update(Buffer.from(data)).digest('hex')
}
