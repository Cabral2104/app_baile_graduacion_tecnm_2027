const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const TEST_PORT = 4099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('[E2E] Iniciando servidor Backend de prueba en puerto', TEST_PORT);
  const serverProc = spawn(process.execPath, [path.join(__dirname, '../src/server.js')], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe',
  });

  try {
    await wait(1500);

    // 1. Verificar búsqueda predictiva normalizada (Typeahead sin acentos)
    const searchRes = await fetch(`${BASE_URL}/api/auth/search?q=maria%20lopez`);
    const searchData = await searchRes.json();
    assert.strictEqual(searchRes.status, 200);
    assert.ok(searchData.users.length >= 2, 'Debe encontrar ambos homónimos de María Fernanda López');
    console.log('[OK] 1. Búsqueda predictiva Typeahead normalizada y desambiguación de homónimos');

    // 2. Primer ingreso de alumna sin PIN (Creación de PIN 4 dígitos)
    const firstLoginRes = await fetch(`${BASE_URL}/api/auth/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-valentina', pin: '4321' }),
    });
    const firstLoginData = await firstLoginRes.json();
    assert.strictEqual(firstLoginRes.status, 200);
    assert.ok(firstLoginData.token, 'Debe retornar JWT en primer ingreso');
    console.log('[OK] 2. Creación de PIN de 4 dígitos en primer ingreso y emisión de JWT');

    // 3. Login de Organizadora Admin (PIN 2026)
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-admin-sofia', pin: '2026' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200);
    const adminToken = adminLoginData.token;
    console.log('[OK] 3. Autenticación del Comité Organizador');

    // 4. Obtener galería pública y verificar separación de Modo Memoria (Video) y Día de la Fiesta
    const publicRes = await fetch(`${BASE_URL}/api/media/public`);
    const publicData = await publicRes.json();
    assert.strictEqual(publicRes.status, 200);
    const modoMemoriaCount = publicData.items.filter((i) => i.estado === 'APROBADO_VIDEO').length;
    const diaFiestaCount = publicData.items.filter((i) => i.origen === 'EN_VIVO').length;
    assert.ok(modoMemoriaCount >= 3, 'Debe haber al menos 3 recuerdos en Modo Memoria (Al Video)');
    assert.ok(diaFiestaCount >= 3, 'Debe haber al menos 3 fotos en Día de la Fiesta');
    console.log(`[OK] 4. Galería verificada: ${modoMemoriaCount} en Modo Memoria y ${diaFiestaCount} en Día de la Fiesta`);

    // 5. Exportación de archivo ZIP secuencial (001_INICIO_foto...)
    const zipRes = await fetch(`${BASE_URL}/api/admin/export-zip`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(zipRes.status, 200);
    const zipArrayBuf = await zipRes.arrayBuffer();
    const zipBuf = Buffer.from(zipArrayBuf);
    assert.strictEqual(zipBuf.readUInt32LE(0), 0x04034b50, 'Cabecera PKZIP válida');
    console.log(`[OK] 5. Exportación ZIP Secuencial válida (${zipBuf.length} bytes)`);

    // 6. Restablecer el PIN de un alumno con 1 clic
    const resetRes = await fetch(`${BASE_URL}/api/admin/users/usr-valentina/reset-pin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resetRes.status, 200);
    console.log('[OK] 6. Restablecimiento de PIN con un clic por parte de organizadoras');

    console.log('\n[E2E COMPLETADO] Todas las pruebas pasaron exitosamente.');
  } finally {
    serverProc.kill();
  }
}

runTests().catch((err) => {
  console.error('[E2E ERROR]:', err);
  process.exit(1);
});

