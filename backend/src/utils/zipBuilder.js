/**
 * Generador nativo de archivos ZIP (formato PKZIP estándar) sin dependencias externas.
 * Permite empaquetar las fotos y videos aprobados en orden secuencial (001_foto.jpg, 002_clip.mp4).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Construye un Buffer ZIP válido a partir de una lista de archivos [{ name: string, data: Buffer }]
 */
function buildZipBuffer(files) {
  const localFileHeaders = [];
  const centralDirectoryHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(dataBuffer);
    const size = dataBuffer.length;

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Signature
    localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(0, 8);          // Compression method (0 = Store, ideal para JPG/MP4 ya comprimidos)
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0, 12);         // Mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(size, 18);      // Compressed size
    localHeader.writeUInt32LE(size, 22);      // Uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    nameBuffer.copy(localHeader, 30);

    localFileHeaders.push(localHeader, dataBuffer);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + nameBuffer.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by
    centralHeader.writeUInt16LE(20, 6);         // Version needed
    centralHeader.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    centralHeader.writeUInt16LE(0, 10);         // Store method
    centralHeader.writeUInt16LE(0, 12);         // Mod time
    centralHeader.writeUInt16LE(0, 14);         // Mod date
    centralHeader.writeUInt32LE(crc, 16);       // CRC-32
    centralHeader.writeUInt32LE(size, 20);      // Compressed size
    centralHeader.writeUInt32LE(size, 24);      // Uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28); // Filename length
    centralHeader.writeUInt16LE(0, 30);         // Extra field length
    centralHeader.writeUInt16LE(0, 32);         // File comment length
    centralHeader.writeUInt16LE(0, 34);         // Disk number
    centralHeader.writeUInt16LE(0, 36);         // Internal file attributes
    centralHeader.writeUInt32LE(0, 38);         // External file attributes
    centralHeader.writeUInt32LE(offset, 42);    // Relative offset of local header
    nameBuffer.copy(centralHeader, 46);

    centralDirectoryHeaders.push(centralHeader);
    offset += localHeader.length + dataBuffer.length;
  }

  const centralDirectoryBuffer = Buffer.concat(centralDirectoryHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0); // Signature
  endOfCentralDirectory.writeUInt16LE(0, 4);          // Number of this disk
  endOfCentralDirectory.writeUInt16LE(0, 6);          // Disk where CD starts
  endOfCentralDirectory.writeUInt16LE(files.length, 8);  // Total entries on this disk
  endOfCentralDirectory.writeUInt16LE(files.length, 10); // Total entries
  endOfCentralDirectory.writeUInt32LE(centralDirectoryBuffer.length, 12); // Size of CD
  endOfCentralDirectory.writeUInt32LE(offset, 16);    // Offset of start of CD
  endOfCentralDirectory.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...localFileHeaders, centralDirectoryBuffer, endOfCentralDirectory]);
}

module.exports = { buildZipBuffer };

