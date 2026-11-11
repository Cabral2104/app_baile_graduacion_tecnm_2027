const { db } = require('./database');

const users = db.prepare('SELECT COUNT(*) as count FROM User').get().count;
const media = db.prepare('SELECT COUNT(*) as count FROM MediaItem').get().count;
const seq = db.prepare('SELECT COUNT(*) as count FROM SequenceOrder').get().count;

console.log(`[Seed completado] Usuarios: ${users} | Archivos multimedia: ${media} | Secuencia Storyboard: ${seq}`);

