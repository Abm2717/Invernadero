/**
 * SERVICIO ALERTAS
 * 
 * Responsabilidades:
 * 1. Suscribirse al exchange de RabbitMQ para recibir mediciones
 * 2. Analizar si la temperatura o humedad superan los umbrales
 * 3. Si hay alerta, publicarla en RabbitMQ para que la consuma:
 *    - Servicio Notificaciones (para avisar al usuario)
 *    - Servicio Almacenamiento (para guardar el historial)
 */

const amqp = require('amqplib');

const RABBITMQ_URL     = 'amqp://localhost';
const EXCHANGE         = 'invernadero';
const EXCHANGE_ALERTAS = 'invernadero.alertas';
const QUEUE            = 'alertas.mediciones';

// Umbrales por defecto
// En el sistema completo estos vendrán de la BD (tabla sensores)
const UMBRAL_TEMPERATURA = 35;
const UMBRAL_HUMEDAD     = 85;

let canal = null;

async function iniciar() {
  try {
    const conexion = await amqp.connect(RABBITMQ_URL);
    canal = await conexion.createChannel();

    // Suscribirse al exchange de mediciones
    await canal.assertExchange(EXCHANGE, 'fanout', { durable: true });
    await canal.assertQueue(QUEUE, { durable: true });
    await canal.bindQueue(QUEUE, EXCHANGE, '');

    // Exchange para publicar alertas (fanout: llega a notificaciones y almacenamiento)
    await canal.assertExchange(EXCHANGE_ALERTAS, 'fanout', { durable: true });

    console.log(`[ALERTAS] Suscrito al exchange "${EXCHANGE}" → cola "${QUEUE}"`);
    console.log(`[ALERTAS] Umbral temperatura: ${UMBRAL_TEMPERATURA}°C | Umbral humedad: ${UMBRAL_HUMEDAD}%`);
    console.log('[ALERTAS] Analizando mediciones...');

    canal.consume(QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const medicion = JSON.parse(msg.content.toString());
        const { sensorId, temperatura, humedad, timestamp } = medicion;

        const alertaTemp    = temperatura > UMBRAL_TEMPERATURA;
        const alertaHumedad = humedad > UMBRAL_HUMEDAD;

        if (alertaTemp || alertaHumedad) {
          const motivo = alertaTemp && alertaHumedad
            ? `Temperatura (${temperatura}°C) y Humedad (${humedad}%) superaron umbrales`
            : alertaTemp
              ? `Temperatura ${temperatura}°C supera umbral de ${UMBRAL_TEMPERATURA}°C`
              : `Humedad ${humedad}% supera umbral de ${UMBRAL_HUMEDAD}%`;

          const alerta = {
            sensorId,
            temperatura,
            humedad,
            timestamp,
            motivo,
            nivel: alertaTemp && alertaHumedad ? 'CRITICO' : 'ADVERTENCIA'
          };

          // Publicar alerta en exchange de alertas
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