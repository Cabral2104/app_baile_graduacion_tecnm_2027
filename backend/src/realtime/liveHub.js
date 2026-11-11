/**
 * Hub de sincronización en Tiempo Real (SSE / Realtime Event Stream)
 * Sincroniza al instante la aprobación de fotos desde el móvil de las organizadoras
 * hacia la pantalla gigante (/pantalla-en-vivo) y paneles administrativos.
 */

const clients = new Set();

function addClient(res) {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

function broadcastEvent(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify({
    type: eventType,
    timestamp: new Date().toISOString(),
    payload,
  })}\n\n`;

  for (const client of clients) {
    try {
      client.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function getConnectedCount() {
  return clients.size;
}

module.exports = {
  addClient,
  broadcastEvent,
  getConnectedCount,
};

