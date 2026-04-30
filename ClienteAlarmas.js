/**
 * CLIENTE ALARMAS
 * 
 * Simula al dueño del invernadero que se registra para recibir
 * notificaciones en tiempo real cuando la temperatura o humedad
 * superen ciertos umbrales.
 * 
 * Comunicacion: WebSocket → conexion persistente con el servidor
 * 
 * Uso:
 *   node cliente-alarmas.js [umbralTemp] [umbralHumedad] [contacto]
 * 
 * Ejemplo:
 *   node cliente-alarmas.js 30 70 "dueno@invernadero.com"
 */

const { WebSocket } = require('ws');

const SERVER_WS = 'ws://localhost:3001';

const umbralTemp    = parseInt(process.argv[2])  || 30;
const umbralHumedad = parseInt(process.argv[3])  || 70;
const contacto      = process.argv[4]            || 'dueno@invernadero.com';

function conectar() {
  const ws = new WebSocket(SERVER_WS);

  ws.on('open', () => {
    console.log(`[ALARMAS] Conectado al servidor WebSocket`);
    console.log(`[ALARMAS] Registrando alarmas → TempMax: ${umbralTemp}°C | HumedadMax: ${umbralHumedad}% | Contacto: ${contacto}`);

    // Registrarse para recibir alarmas
    ws.send(JSON.stringify({
      tipo:          'registrar',
      umbralTemp,
      umbralHumedad,
      contacto
    }));
  });

  ws.on('message', (data) => {
    try {
      const mensaje = JSON.parse(data);

      if (mensaje.tipo === 'confirmacion') {
        console.log(`[ALARMAS] ✅ ${mensaje.mensaje}`);
      }

      if (mensaje.tipo === 'alarma') {
        console.log(`\n[ALARMAS]  ¡ALARMA DETECTADA!`);
        console.log(`[ALARMAS]    Sensor:      ${mensaje.sensorId}`);
        console.log(`[ALARMAS]    Temperatura: ${mensaje.temperatura}°C`);
        console.log(`[ALARMAS]    Humedad:     ${mensaje.humedad}%`);
        console.log(`[ALARMAS]    Motivo:      ${mensaje.motivo}`);
        console.log(`[ALARMAS]    Timestamp:   ${mensaje.timestamp}`);
        console.log(`[ALARMAS]    → Notificacion enviada a: ${contacto}\n`);
      }

    } catch (e) {
      console.error('[ALARMAS] Mensaje invalido recibido');
    }
  });

  ws.on('close', () => {
    console.log('[ALARMAS] Conexion cerrada. Reintentando en 3s...');
    setTimeout(conectar, 3000);
  });

  ws.on('error', (err) => {
    console.error(`[ALARMAS] Error: ${err.message}. Reintentando en 3s...`);
    setTimeout(conectar, 3000);
  });
}

console.log(`[ALARMAS] Cliente de alarmas iniciando...`);
conectar();