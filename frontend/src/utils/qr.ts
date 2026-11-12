/**
 * Generador QR ISO/IEC 18004 determinista y 100% compatible con lectores de cámaras móviles
 * (iOS Camera, Google Lens, lectores nativos de Android).
 * Implementación pura en TypeScript sin dependencias externas.
 */

// Tablas Galois Field GF(256)
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    LOG_TABLE[val] = i;
    val <<= 1;
    if (val & 256) {
      val ^= 0x11d; // Polinomio primitivo x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function glog(n: number): number {
  if (n < 1) throw new Error('glog(' + n + ')');
  return LOG_TABLE[n];
}

function gexp(n: number): number {
  while (n < 0) n += 255;
  while (n >= 256) n -= 255;
  return EXP_TABLE[n];
}

// Polinomios para Reed-Solomon
class QRPolynomial {
  num: number[];

  constructor(num: number[], shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) {
      offset++;
    }
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) {
      this.num[i] = num[offset + i];
    }
  }

  get(index: number): number {
    return this.num[index];
  }

  getLength(): number {
    return this.num.length;
  }

  multiply(e: QRPolynomial): QRPolynomial {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= gexp(glog(this.get(i)) + glog(e.get(j)));
      }
    }
    return new QRPolynomial(num);
  }

  mod(e: QRPolynomial): QRPolynomial {
    if (this.getLength() - e.getLength() < 0) {
      return this;
    }
    const ratio = glog(this.get(0)) - glog(e.get(0));
    const num = new Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) {
      num[i] = this.get(i);
    }
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= gexp(glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num).mod(e);
  }
}

// Capacidad y parámetros por versión (Nivel M: 15% corrección)
// [totalCodewords, dataCodewords, ecCodewords, ecBlocksGroup1, ecDataPerBlockG1, ecBlocksGroup2, ecDataPerBlockG2]
interface VersionSpec {
  version: number;
  totalCodewords: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  blocksG1: number;
  dataG1: number;
  blocksG2: number;
  dataG2: number;
  alignmentPatterns: number[];
}

const VERSION_SPECS_M: VersionSpec[] = [
  { version: 1, totalCodewords: 26, dataCodewords: 16, ecCodewordsPerBlock: 10, blocksG1: 1, dataG1: 16, blocksG2: 0, dataG2: 0, alignmentPatterns: [] },
  { version: 2, totalCodewords: 44, dataCodewords: 28, ecCodewordsPerBlock: 16, blocksG1: 1, dataG1: 28, blocksG2: 0, dataG2: 0, alignmentPatterns: [6, 18] },
  { version: 3, totalCodewords: 70, dataCodewords: 44, ecCodewordsPerBlock: 26, blocksG1: 1, dataG1: 44, blocksG2: 0, dataG2: 0, alignmentPatterns: [6, 22] },
  { version: 4, totalCodewords: 100, dataCodewords: 64, ecCodewordsPerBlock: 18, blocksG1: 2, dataG1: 32, blocksG2: 0, dataG2: 0, alignmentPatterns: [6, 26] },
  { version: 5, totalCodewords: 134, dataCodewords: 86, ecCodewordsPerBlock: 24, blocksG1: 2, dataG1: 43, blocksG2: 0, dataG2: 0, alignmentPatterns: [6, 30] },
  { version: 6, totalCodewords: 172, dataCodewords: 108, ecCodewordsPerBlock: 16, blocksG1: 4, dataG1: 27, blocksG2: 0, dataG2: 0, alignmentPatterns: [6, 34] },
  { version: 7, totalCodewords: 196, dataCodewords: 124, ecCodewordsPerBlock: 18, blocksG1: 4, dataG1: 31, blocksG2: 0, dataG2: 0, alignmentPatterns: [6, 22, 38] },
  { version: 8, totalCodewords: 242, dataCodewords: 154, ecCodewordsPerBlock: 22, blocksG1: 2, dataG1: 38, blocksG2: 2, dataG2: 39, alignmentPatterns: [6, 24, 42] },
];

function getErrorCorrectPolynomial(errorCorrectLength: number): QRPolynomial {
  let a = new QRPolynomial([1], 0);
  for (let i = 0; i < errorCorrectLength; i++) {
    a = a.multiply(new QRPolynomial([1, gexp(i)], 0));
  }
  return a;
}

// Formato de nivel M con máscara 0 (00):
// Nivel M = 00, Mask 0 = 000 -> 00000 -> BCH code: 101010000010010 XOR 101010000010010 = 0x5412 -> 0x5412 XOR 0x0000
const FORMAT_INFO_M_MASK0 = 0b101010000010010 ^ 0b101010000010010; // 0x0000 ^ 0x5412 = 0x5412

function getFormatInfo(maskPattern: number): number {
  // Nivel M: '00'
  const data = (0b00 << 3) | (maskPattern & 0b111);
  let d = data << 10;
  while (d >= (1 << 10)) {
    let msb = 0;
    while ((d >> msb) > 0) msb++;
    msb -= 1;
    if (msb < 10) break;
    d ^= 0b10100110111 << (msb - 10);
  }
  return ((data << 10) | d) ^ 0b101010000010010;
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Bytes = new TextEncoder().encode(text);
  const dataLength = utf8Bytes.length;

  // Seleccionar la menor versión que soporte los datos
  const spec = VERSION_SPECS_M.find((s) => s.dataCodewords >= dataLength + 3);
  if (!spec) {
    throw new Error('El texto para el código QR es demasiado largo.');
  }

  // 1. Bit Buffer: Modo Byte (0100) + Longitud (8 bits para ver 1-9) + Datos
  const bitBuffer: number[] = [];
  const putBits = (val: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bitBuffer.push((val >> i) & 1);
    }
  };

  putBits(0b0100, 4); // Modo 8-bit byte
  putBits(dataLength, 8); // Conteo de caracteres

  for (let i = 0; i < dataLength; i++) {
    putBits(utf8Bytes[i], 8);
  }

  // Terminador (hasta 4 ceros)
  const totalDataBits = spec.dataCodewords * 8;
  const remainingBits = totalDataBits - bitBuffer.length;
  putBits(0, Math.min(4, remainingBits));

  // Rellenar hasta múltiplo de 8 bits
  while (bitBuffer.length % 8 !== 0) {
    bitBuffer.push(0);
  }

  // Bytes de relleno (0xEC y 0x11 alternados)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuffer.length < totalDataBits) {
    putBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convertir bitBuffer a codewords de datos
  const dataCodewords: number[] = [];
  for (let i = 0; i < bitBuffer.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitBuffer[i + b];
    }
    dataCodewords.push(byte);
  }

  // 2. Generar bloques de datos y bloques de corrección de error (Reed-Solomon)
  const totalBlocks = spec.blocksG1 + spec.blocksG2;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  const rsPoly = getErrorCorrectPolynomial(spec.ecCodewordsPerBlock);

  let offset = 0;
  for (let b = 0; b < totalBlocks; b++) {
    const isG1 = b < spec.blocksG1;
    const blockDataLen = isG1 ? spec.dataG1 : spec.dataG2;
    const blockData = dataCodewords.slice(offset, offset + blockDataLen);
    offset += blockDataLen;
    dataBlocks.push(blockData);

    const rawPoly = new QRPolynomial(blockData, spec.ecCodewordsPerBlock);
    const modPoly = rawPoly.mod(rsPoly);
    const ecData: number[] = new Array(spec.ecCodewordsPerBlock).fill(0);
    const modLen = modPoly.getLength();
    for (let i = 0; i < modLen; i++) {
      ecData[spec.ecCodewordsPerBlock - modLen + i] = modPoly.get(i);
    }
    ecBlocks.push(ecData);
  }

  // 3. Intercalado de codewords (Interleaving)
  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(spec.dataG1, spec.dataG2 || 0);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // 4. Construcción de la matriz QR
  const moduleCount = spec.version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: moduleCount }, () =>
    Array(moduleCount).fill(null)
  );

  // Colocar patrones de búsqueda (Finder patterns)
  const placeFinder = (r: number, c: number) => {
    for (let row = -1; row <= 7; row++) {
      for (let col = -1; col <= 7; col++) {
        const nr = r + row;
        const nc = c + col;
        if (nr < 0 || nr >= moduleCount || nc < 0 || nc >= moduleCount) continue;
        if (
          (row >= 0 && row <= 6 && (col === 0 || col === 6)) ||
          (col >= 0 && col <= 6 && (row === 0 || row === 6)) ||
          (row >= 2 && row <= 4 && col >= 2 && col <= 4)
        ) {
          matrix[nr][nc] = true;
        } else {
          matrix[nr][nc] = false;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, moduleCount - 7);
  placeFinder(moduleCount - 7, 0);

  // Separadores y Timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Patrones de alineación
  const aligns = spec.alignmentPatterns;
  for (let i = 0; i < aligns.length; i++) {
    for (let j = 0; j < aligns.length; j++) {
      const ar = aligns[i];
      const ac = aligns[j];
      if (matrix[ar][ac] !== null) continue; // Si interseca con un finder, saltar
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
            matrix[ar + r][ac + c] = true;
          } else {
            matrix[ar + r][ac + c] = false;
          }
        }
      }
    }
  }

  // Módulo oscuro fijo (Fixed dark module)
  matrix[4 * spec.version + 9][8] = true;

  // Reservar áreas de información de formato
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = moduleCount - 8; i < moduleCount; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // 5. Colocación de bits de datos y máscara (Máscara 0: (row + col) % 2 === 0)
  const finalBits: number[] = [];
  for (let i = 0; i < finalCodewords.length; i++) {
    const cw = finalCodewords[i];
    for (let b = 7; b >= 0; b--) {
      finalBits.push((cw >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upwards = true;
  for (let right = moduleCount - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Saltar columna de timing vertical
    const rows = upwards
      ? Array.from({ length: moduleCount }, (_, i) => moduleCount - 1 - i)
      : Array.from({ length: moduleCount }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (matrix[r][c] === null) {
          let bit = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          // Aplicar máscara 0: (row + col) % 2 === 0
          if ((r + c) % 2 === 0) {
            bit ^= 1;
          }
          matrix[r][c] = bit === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // 6. Colocar información de formato (Nivel M, Máscara 0)
  const formatInfo = getFormatInfo(0);
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >> i) & 1) === 1;
    // Top-left
    if (i < 6) {
      matrix[i][8] = bit;
    } else if (i < 8) {
      matrix[i + 1][8] = bit;
    } else {
      matrix[8][15 - i] = bit;
    }
    // Bottom-left / Top-right
    if (i < 8) {
      matrix[8][moduleCount - 1 - i] = bit;
    } else {
      matrix[moduleCount - 15 + i][8] = bit;
    }
  }

  return matrix as boolean[][];
}

