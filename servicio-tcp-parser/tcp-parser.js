/**
 * SERVICIO TCP / PARSER
 * 
 * Responsabilidades:
 * 1. Escuchar conexiones TCP del Gateway (puerto 7000)
 * 2. Recibir paquetes binarios de 4 bytes
 * 3. Decodificar y validar cada paquete
 * 4. Publicar los datos en RabbitMQ para que los consuman:
 *    - Servicio Almacenamiento
 *    - Servicio Alertas
 */

const net    = require('net');
const amqp   = require('amqplib');

const TCP_PORT     = 7000;
const RABBITMQ_URL = 'amqp://localhost';
const EXCHANGE     = 'invernadero';

let canal = null;

// ---------------------------------------------------------
// Conexión a RabbitMQ
// ---------------------------------------------------------
async function conectarRabbitMQ() {
  try {
    const conexion = await amqp.connect(RABBITMQ_URL);
    canal = await conexion.createChannel();

    // Exchange tipo fanout: distribuye el mismo mensaje a todos los suscriptores
    await canal.assertExchange(EXCHANGE, 'fanout', { durable: true });

    console.log(`[TCP-PARSER] Conectado a RabbitMQ. Exchange: "${EXCHANGE}"`);

    conexion.on('close', () => {
      console.warn('[TCP-PARSER] Conexión RabbitMQ cerrada. Reintentando en 3s...');
      canal = null;
      setTimeout(conectarRabbitMQ, 3000);
    });

    conexion.on('error', (err) => {
      console.error('[TCP-PARSER] Error RabbitMQ:', err.message);
    });

  } catch (err) {
    console.error('[TCP-PARSER] No se pudo conectar a RabbitMQ:', err.message);
    setTimeout(conectarRabbitMQ, 3000);
  }
}

// ---------------------------------------------------------
// Publicar medición en RabbitMQ
// ---------------------------------------------------------
function publicarMedicion(medicion) {
  if (!canal) {
    console.warn('[TCP-PARSER] Sin conexión a RabbitMQ, descartando medición');
    return;
  }

  const mensaje = JSON.stringify(medicion);
  canal.publish(EXCHANGE, '', Buffer.from(mensaje), { persistent: true });
  console.log(`[TCP-PARSER] Publicado → ${mensaje}`);
}

// ---------------------------------------------------------
// Servidor TCP
// ---------------------------------------------------------
const servidorTCP = net.createServer((socket) => {
  const direccion = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[TCP-PARSER] Gateway conectado desde ${direccion}`);

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
        console.warn(`[TCP-PARSER] Paquete descartado - checksum inválido`);
        continue;
      }

      const medicion = {
        sensorId,
        temperatura,
        humedad,
        timestamp: new Date().toISOString(),
        raw: paquete.toString('hex').toUpperCase()
      };

      console.log(`[TCP-PARSER] Recibido ← Sensor: ${sensorId} | Temp: ${temperatura}°C | Humedad: ${humedad}%`);
      publicarMedicion(medicion);
    }
  });

  socket.on('close', () => {
    console.log(`[TCP-PARSER] Gateway desconectado: ${direccion}`);
  });

  socket.on('error', (err) => {
    console.error(`[TCP-PARSER] Error con Gateway: ${err.message}`);
  });
});

servidorTCP.listen(TCP_PORT, async () => {
  console.log(`[TCP-PARSER] Escuchando Gateway en puerto TCP ${TCP_PORT}`);
  await conectarRabbitMQ();
});