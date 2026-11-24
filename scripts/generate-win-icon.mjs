import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
  }
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function createIconPng(size = 256) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4
      const margin = 16
      const inBox = x >= margin && x < size - margin && y >= margin && y < size - margin
      if (!inBox) {
        raw[idx] = 0; raw[idx + 1] = 0; raw[idx + 2] = 0; raw[idx + 3] = 0
        continue
      }
      const nx = (x - margin) / (size - 2 * margin)
      const ny = (y - margin) / (size - 2 * margin)
      const isLeftBar = nx >= 0.18 && nx <= 0.30 && ny >= 0.22 && ny <= 0.78
      const isRightBar = nx >= 0.70 && nx <= 0.82 && ny >= 0.22 && ny <= 0.78
      const isLeftDiag = ny >= 0.22 && ny <= 0.62 && Math.abs((nx - 0.24) - (ny - 0.22) * 0.65) < 0.065
      const isRightDiag = ny >= 0.22 && ny <= 0.62 && Math.abs((0.76 - nx) - (ny - 0.22) * 0.65) < 0.065

      if (isLeftBar || isRightBar || isLeftDiag || isRightDiag) {
        raw[idx] = 255; raw[idx + 1] = 255; raw[idx + 2] = 255; raw[idx + 3] = 255
      } else {
        const t = y / size
        raw[idx] = Math.round(0 + t * 14)
        raw[idx + 1] = Math.round(122 - t * 32)
        raw[idx + 2] = Math.round(204 - t * 40)
        raw[idx + 3] = 255
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

function pngToIco(pngBuf) {
  const header = Buffer.alloc(22)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(1, 4)
  header[6] = 0
  header[7] = 0
  header.writeUInt16LE(1, 10)
  header.writeUInt16LE(32, 12)
  header.writeUInt32LE(pngBuf.length, 14)
  header.writeUInt32LE(22, 18)
  return Buffer.concat([header, pngBuf])
}

const outDir = path.resolve('build')
fs.mkdirSync(outDir, { recursive: true })
const png = createIconPng(256)
fs.writeFileSync(path.join(outDir, 'icon.png'), png)
fs.writeFileSync(path.join(outDir, 'icon.ico'), pngToIco(png))
console.log('Generated build/icon.png and build/icon.ico successfully.')
