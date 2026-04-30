/**
 * SENSOR SIMULADO
 * 
 * Simula un sensor de invernadero que envia datos de temperatura y humedad
 * al Gateway en formato binario por TCP.
 * 
 * Formato del paquete binario (4 bytes):
 * [0] SENSOR_ID  - 1 byte  (0-255)
 * [1] TEMP       - 1 byte  (0-100 °C)
 * [2] HUMEDAD    - 1 byte  (0-100 %)
 * [3] CHECKSUM   - 1 byte  (ID + TEMP + HUMEDAD) % 256
 */

const net = require('net');

const GATEWAY_HOST = '127.0.0.1';
const GATEWAY_PORT = 5000;

// Configuracion del sensor (puede cambiar por args o env)
const SENSOR_ID = parseInt(process.argv[2]) || 1;
const INTERVALO_MS = 2000; // cada 2 segundos

function generarDatos() {
  const temperatura = Math.floor(Math.random() * (40 - 15 + 1)) + 15; // 15-40 °C
  const humedad = Math.floor(Math.random() * (95 - 30 + 1)) + 30;     // 30-95 %
  return { temperatura, humedad };
}

function empaquetarBinario(sensorId, temperatura, humedad) {
  const buffer = Buffer.alloc(4);
  buffer[0] = sensorId;
  buffer[1] = temperatura;
  buffer[2] = humedad;
  buffer[3] = (sensorId + temperatura + humedad) % 256; // checksum simple
  return buffer;
}

function conectarYEnviar() {
  const socket = new net.Socket();

  socket.connect(GATEWAY_PORT, GATEWAY_HOST, () => {
    console.log(`[SENSOR ${SENSOR_ID}] Conectado al Gateway ${GATEWAY_HOST}:${GATEWAY_PORT}`);

    const intervalo = setInterval(() => {
      const { temperatura, humedad } = generarDatos();
      const paquete = empaquetarBinario(SENSOR_ID, temperatura, humedad);

      socket.write(paquete, () => {
        console.log(`[SENSOR ${SENSOR_ID}] Enviado → Temp: ${temperatura}°C | Humedad: ${humedad}% | Bytes: ${paquete.toString('hex').toUpperCase()}`);
      });
    }, INTERVALO_MS);

    socket.on('close', () => {
      clearInterval(intervalo);
      console.log(`[SENSOR ${SENSOR_ID}] Conexion cerrada. Reintentando en 3s...`);
      setTimeout(conectarYEnviar, 3000);
    });
  });

  socket.on('error', (err) => {
    console.error(`[SENSOR ${SENSOR_ID}] Error: ${err.message}. Reintentando en 3s...`);
    setTimeout(conectarYEnviar, 3000);
  });
}

console.log(`[SENSOR ${SENSOR_ID}] Iniciando sensor simulado...`);
conectarYEnviar();