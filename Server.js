/**
 * SERVIDOR CENTRAL
 * 
 * Responsabilidades:
 * 1. Escuchar datos binarios del Gateway por TCP (puerto 6000)
 * 2. Decodificar y validar cada paquete
 * 3. Almacenar mediciones en memoria
 * 4. Exponer datos via API REST (puerto 3000)
 * 5. Notificar alarmas en tiempo real via WebSocket (puerto 3001)
 */

const net        = require('net');
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { WebSocketServer } = require('ws');

const TCP_PORT  = 6000;
const HTTP_PORT = 3000;
const WS_PORT   = 3001;

// ---------------------------------------------------------
// Almacenamiento en memoria
// Con la implementacion de BD se mandaria a Supabase aqui 
// ---------------------------------------------------------
const mediciones = [];

function guardarMedicion(datos) {
  mediciones.push(datos);
  // Mantener solo las ultimas 500 mediciones en memoria
  if (mediciones.length > 500) mediciones.shift();
}

function obtenerMediciones(sensorId) {
  if (sensorId) {
    return mediciones.filter(m => m.sensorId === parseInt(sensorId));
  }
  return mediciones;
}

// ---------------------------------------------------------
// WebSocket Server (notificaciones de alarmas en tiempo real)
// ---------------------------------------------------------

// Registro de clientes suscritos a alarmas
// { ws, sensorId, umbralTemp, umbralHumedad, contacto }
const suscriptores = [];

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log(`[SERVIDOR] Cliente WebSocket conectado`);

  ws.on('message', (mensaje) => {
    try {
      const datos = JSON.parse(mensaje);

      // El cliente se registra con sus umbrales de alarma
      if (datos.tipo === 'registrar') {
        const suscriptor = {
          ws,
          sensorId:      datos.sensorId      || null, // null = todos los sensores
          umbralTemp:    datos.umbralTemp     || 35,
          umbralHumedad: datos.umbralHumedad  || 85,
          contacto:      datos.contacto       || 'sin contacto'
        };
        suscriptores.push(suscriptor);
        console.log(`[SERVIDOR] Alarma registrada → Contacto: ${suscriptor.contacto} | TempMax: ${suscriptor.umbralTemp}°C | HumedadMax: ${suscriptor.umbralHumedad}%`);

        ws.send(JSON.stringify({
          tipo: 'confirmacion',
          mensaje: `Alarma registrada. Se notificara si Temp > ${suscriptor.umbralTemp}°C o Humedad > ${suscriptor.umbralHumedad}%`
        }));
      }
    } catch (e) {
      console.error('[SERVIDOR] Mensaje WebSocket invalido:', e.message);
    }
  });

  ws.on('close', () => {
    // Remover suscriptor al desconectarse
    const idx = suscriptores.findIndex(s => s.ws === ws);
    if (idx !== -1) suscriptores.splice(idx, 1);
    console.log(`[SERVIDOR] Cliente WebSocket desconectado`);
  });
});

function verificarAlarmas(medicion) {
  suscriptores.forEach(suscriptor => {
    // Filtrar por sensorId si el suscriptor lo especifico
    if (suscriptor.sensorId && suscriptor.sensorId !== medicion.sensorId) return;

    const alertaTemp    = medicion.temperatura > suscriptor.umbralTemp;
    const alertaHumedad = medicion.humedad > suscriptor.umbralHumedad;

    if (alertaTemp || alertaHumedad) {
      const alarma = {
        tipo:        'alarma',
        sensorId:    medicion.sensorId,
        temperatura: medicion.temperatura,
        humedad:     medicion.humedad,
        timestamp:   medicion.timestamp,
        motivo:      alertaTemp && alertaHumedad
                       ? `Temperatura (${medicion.temperatura}°C) y Humedad (${medicion.humedad}%) superaron umbrales`
                       : alertaTemp
                         ? `Temperatura ${medicion.temperatura}°C supera umbral de ${suscriptor.umbralTemp}°C`
                         : `Humedad ${medicion.humedad}% supera umbral de ${suscriptor.umbralHumedad}%`
      };

      if (suscriptor.ws.readyState === suscriptor.ws.OPEN) {
        suscriptor.ws.send(JSON.stringify(alarma));
        console.log(`[SERVIDOR] 🚨 Alarma enviada → ${suscriptor.contacto} | ${alarma.motivo}`);
      }
    }
  });
}

console.log(`[SERVIDOR] WebSocket escuchando en puerto ${WS_PORT}`);

// ---------------------------------------------------------
// Servidor TCP (recibe datos del Gateway)
// ---------------------------------------------------------
const servidorTCP = net.createServer((socket) => {
  console.log(`[SERVIDOR] Gateway conectado desde ${socket.remoteAddress}:${socket.remotePort}`);

  socket.on('data', (data) => {
    // Procesar paquetes de 4 bytes
    for (let i = 0; i + 3 < data.length; i += 4) {
      const paquete = data.slice(i, i + 4);

      const sensorId    = paquete[0];
      const temperatura = paquete[1];
      const humedad     = paquete[2];
      const checksum    = paquete[3];
      const checksumEsperado = (sensorId + temperatura + humedad) % 256;

      if (checksum !== checksumEsperado) {
        console.warn(`[SERVIDOR] Paquete descartado - checksum invalido`);
        continue;
      }

      const medicion = {
        sensorId,
        temperatura,
        humedad,
        timestamp: new Date().toISOString(),
        raw: paquete.toString('hex').toUpperCase()
      };

      guardarMedicion(medicion);
      verificarAlarmas(medicion);
      console.log(`[SERVIDOR] Guardado ✓ | Sensor: ${sensorId} | Temp: ${temperatura}°C | Humedad: ${humedad}% | ${medicion.timestamp}`);
    }
  });

  socket.on('close', () => {
    console.log('[SERVIDOR] Gateway desconectado');
  });

  socket.on('error', (err) => {
    console.error(`[SERVIDOR] Error TCP: ${err.message}`);
  });
});

servidorTCP.listen(TCP_PORT, () => {
  console.log(`[SERVIDOR] Escuchando Gateway en puerto TCP ${TCP_PORT}`);
});

// ---------------------------------------------------------
// API REST (expone datos a sistemas externos)
// ---------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// GET /mediciones — todas las mediciones (opcional: ?sensorId=1)
app.get('/mediciones', (req, res) => {
  const { sensorId } = req.query;
  const datos = obtenerMediciones(sensorId);
  res.json({
    total: datos.length,
    mediciones: datos
  });
});

// GET /mediciones/ultima — ultima medicion por sensor
app.get('/mediciones/ultima', (req, res) => {
  const porSensor = {};
  mediciones.forEach(m => {
    porSensor[m.sensorId] = m; // sobreescribe, queda la mas reciente
  });
  res.json({
    sensores: Object.values(porSensor)
  });
});

// GET /sensores — lista de sensores detectados
app.get('/sensores', (req, res) => {
  const ids = [...new Set(mediciones.map(m => m.sensorId))];
  res.json({
    total: ids.length,
    sensores: ids.map(id => ({ sensorId: id }))
  });
});

// GET /status — estado del sistema
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    totalMediciones: mediciones.length,
    suscriptoresAlarma: suscriptores.length,
    timestamp: new Date().toISOString()
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`[SERVIDOR] API REST disponible en http://localhost:${HTTP_PORT}`);
  console.log(`[SERVIDOR] Endpoints:`);
  console.log(`           GET /status`);
  console.log(`           GET /sensores`);
  console.log(`           GET /mediciones`);
  console.log(`           GET /mediciones?sensorId=1`);
  console.log(`           GET /mediciones/ultima`);
  console.log(`[SERVIDOR] WebSocket alarmas en ws://localhost:${WS_PORT}`);
});