/**
 * SERVICIO ALERTAS
 * 
 * Responsabilidades:
 * 1. Suscribirse al exchange de RabbitMQ para recibir mediciones
 * 2. Consultar umbrales del sensor via gRPC al Servicio Sensores
 * 3. Si hay alerta, publicarla en RabbitMQ para Notificaciones y Almacenamiento
 */

const amqp       = require('amqplib');
const grpc       = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path       = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE         = 'invernadero';
const EXCHANGE_ALERTAS = 'invernadero.alertas';
const QUEUE            = 'alertas.mediciones';
const GRPC_SENSORES = process.env.GRPC_SENSORES || 'localhost:50051';

// ---------------------------------------------------------
// Cliente gRPC hacia Servicio Sensores
// ---------------------------------------------------------
const PROTO_PATH = path.join(__dirname, 'proto', 'sensores.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});
const proto = grpc.loadPackageDefinition(packageDef).sensores;
const clienteSensores = new proto.SensorService(GRPC_SENSORES, grpc.credentials.createInsecure());

// ---------------------------------------------------------
// Consultar umbrales del sensor via gRPC
// ---------------------------------------------------------
function obtenerUmbralesSensor(sensorId) {
  return new Promise((resolve, reject) => {
    clienteSensores.ObtenerSensor({ id: sensorId }, (err, response) => {
      if (err) return reject(err);
      if (!response.encontrado) {
        console.warn(`[ALERTAS] Sensor ID ${sensorId} no registrado en BD, usando umbrales por defecto`);
        return resolve({ umbralTemperatura: 35, umbralHumedad: 85 });
      }
      console.log(`[ALERTAS gRPC] Umbrales obtenidos | Sensor ${sensorId} | Temp: ${response.umbralTemperatura}°C | Hum: ${response.umbralHumedad}%`);
      resolve({
        umbralTemperatura: response.umbralTemperatura,
        umbralHumedad:     response.umbralHumedad
      });
    });
  });
}

let canal = null;

async function iniciar() {
  try {
    const conexion = await amqp.connect(RABBITMQ_URL);
    canal = await conexion.createChannel();

    await canal.assertExchange(EXCHANGE, 'fanout', { durable: true });
    await canal.assertQueue(QUEUE, { durable: true });
    await canal.bindQueue(QUEUE, EXCHANGE, '');

    await canal.assertExchange(EXCHANGE_ALERTAS, 'fanout', { durable: true });

    console.log(`[ALERTAS] Suscrito al exchange "${EXCHANGE}" → cola "${QUEUE}"`);
    console.log(`[ALERTAS] Consultando umbrales via gRPC → ${GRPC_SENSORES}`);
    console.log('[ALERTAS] Analizando mediciones...');

    canal.consume(QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const medicion = JSON.parse(msg.content.toString());
        const { sensorId, temperatura, humedad, timestamp } = medicion;

        // Consultar umbrales del sensor via gRPC
        const { umbralTemperatura, umbralHumedad } = await obtenerUmbralesSensor(sensorId);

        const alertaTemp    = temperatura > umbralTemperatura;
        const alertaHumedad = humedad > umbralHumedad;

        if (alertaTemp || alertaHumedad) {
          const motivo = alertaTemp && alertaHumedad
            ? `Temperatura (${temperatura}°C) y Humedad (${humedad}%) superaron umbrales`
            : alertaTemp
              ? `Temperatura ${temperatura}°C supera umbral de ${umbralTemperatura}°C`
              : `Humedad ${humedad}% supera umbral de ${umbralHumedad}%`;

          const alerta = {
            sensorId,
            temperatura,
            humedad,
            timestamp,
            motivo,
            nivel: alertaTemp && alertaHumedad ? 'CRITICO' : 'ADVERTENCIA'
          };

          canal.publish(EXCHANGE_ALERTAS, '', Buffer.from(JSON.stringify(alerta)), { persistent: true });
          console.log(`[ALERTAS] 🚨 Alerta publicada | Sensor: ${sensorId} | Nivel: ${alerta.nivel} | ${motivo}`);
        } else {
          console.log(`[ALERTAS] ✓ OK | Sensor: ${sensorId} | Temp: ${temperatura}°C | Humedad: ${humedad}%`);
        }

        canal.ack(msg);

      } catch (err) {
        console.error('[ALERTAS] Error procesando medición:', err.message);
        canal.nack(msg, false, false);
      }
    });

    conexion.on('close', () => {
      console.warn('[ALERTAS] Conexión RabbitMQ cerrada. Reintentando en 3s...');
      setTimeout(iniciar, 3000);
    });

  } catch (err) {
    console.error('[ALERTAS] Error al iniciar:', err.message);
    setTimeout(iniciar, 3000);
  }
}

iniciar();