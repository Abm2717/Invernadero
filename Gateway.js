/**
 * GATEWAY
 * 
 * Recibe datos binarios de uno o mas sensores por TCP (puerto 5000)
 * y los reenvia al Servidor central por TCP (puerto 6000).
 * 
 * Es el intermediario entre el campo (sensores) y el backend (servidor).
 * Puede recibir conexiones de multiples sensores simultaneamente.
 */

const net = require('net');

const GATEWAY_PORT = 5000;       // Puerto donde escucha a los sensores
const SERVER_HOST  = '127.0.0.1';
const SERVER_PORT  = 6000;       // Puerto del servidor central

// Conexion persistente al servidor
let socketServidor = null;
let bufferPendiente = []; // guarda paquetes si el servidor no esta conectado aun

function conectarAlServidor() {
  socketServidor = new net.Socket();

  socketServidor.connect(SERVER_PORT, SERVER_HOST, () => {
    console.log(`[GATEWAY] Conectado al Servidor ${SERVER_HOST}:${SERVER_PORT}`);

    // Enviar paquetes que quedaron pendientes
    if (bufferPendiente.length > 0) {
      console.log(`[GATEWAY] Enviando ${bufferPendiente.length} paquete(s) pendiente(s)...`);
      bufferPendiente.forEach(p => socketServidor.write(p));
      bufferPendiente = [];
    }
  });

  socketServidor.on('error', (err) => {
    console.error(`[GATEWAY] Error con Servidor: ${err.message}. Reintentando en 3s...`);
    setTimeout(conectarAlServidor, 3000);
  });

  socketServidor.on('close', () => {
    console.warn('[GATEWAY] Conexion con Servidor cerrada. Reintentando en 3s...');
    setTimeout(conectarAlServidor, 3000);
  });
}

// Servidor TCP que escucha a los sensores
const servidorSensores = net.createServer((socketSensor) => {
  const direccion = `${socketSensor.remoteAddress}:${socketSensor.remotePort}`;
  console.log(`[GATEWAY] Sensor conectado desde ${direccion}`);

  socketSensor.on('data', (data) => {
    // Procesar paquetes de 4 bytes
    for (let i = 0; i + 3 < data.length; i += 4) {
      const paquete = data.slice(i, i + 4);

      const sensorId   = paquete[0];
      const temperatura = paquete[1];
      const humedad    = paquete[2];
      const checksum   = paquete[3];
      const checksumEsperado = (sensorId + temperatura + humedad) % 256;

      if (checksum !== checksumEsperado) {
        console.warn(`[GATEWAY] Paquete invalido del sensor ${sensorId} - checksum incorrecto`);
        continue;
      }

      console.log(`[GATEWAY] Recibido ← Sensor: ${sensorId} | Temp: ${temperatura}°C | Humedad: ${humedad}% | Raw: ${paquete.toString('hex').toUpperCase()}`);

      // Reenviar al servidor
      if (socketServidor && !socketServidor.destroyed) {
        socketServidor.write(paquete, () => {
          console.log(`[GATEWAY] Reenviado → Servidor | Raw: ${paquete.toString('hex').toUpperCase()}`);
        });
      } else {
        console.warn('[GATEWAY] Servidor no disponible, guardando paquete en buffer...');
        bufferPendiente.push(paquete);
      }
    }
  });

  socketSensor.on('close', () => {
    console.log(`[GATEWAY] Sensor desconectado: ${direccion}`);
  });

  socketSensor.on('error', (err) => {
    console.error(`[GATEWAY] Error con sensor ${direccion}: ${err.message}`);
  });
});

servidorSensores.listen(GATEWAY_PORT, () => {
  console.log(`[GATEWAY] Escuchando sensores en puerto ${GATEWAY_PORT}`);
  console.log(`[GATEWAY] Conectando al Servidor en ${SERVER_HOST}:${SERVER_PORT}...`);
  conectarAlServidor();
});