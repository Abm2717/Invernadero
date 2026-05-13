/**
 * SERVICIO NOTIFICACIONES
 * 
 * Responsabilidades:
 * 1. Suscribirse al exchange de alertas de RabbitMQ
 * 2. Recibir alertas publicadas por el Servicio Alertas
 * 3. Simular envío de correo (para conectar correo real: usar nodemailer)
 * 
 * Nota: El historial de notificaciones lo guarda el Servicio Almacenamiento
 * directamente desde el exchange invernadero.alertas
 */

const amqp = require('amqplib');

const RABBITMQ_URL     = 'amqp://localhost';
const EXCHANGE_ALERTAS = 'invernadero.alertas';
const QUEUE            = 'notificaciones.alertas';

const CORREO_DESTINO = 'dueno@invernadero.com';

// ---------------------------------------------------------
// Simulación de envío de correo
// Para correo real: reemplazar con nodemailer
// ---------------------------------------------------------
async function enviarCorreo(alerta) {
  console.log(`[NOTIFICACIONES] ✉ Simulando envío de correo:`);
  console.log(`[NOTIFICACIONES]   Para:    ${CORREO_DESTINO}`);
  console.log(`[NOTIFICACIONES]   Asunto:  Alerta Sensor ${alerta.sensorId} - Nivel ${alerta.nivel}`);
  console.log(`[NOTIFICACIONES]   Motivo:  ${alerta.motivo}`);
  console.log(`[NOTIFICACIONES]   Temp:    ${alerta.temperatura}°C | Humedad: ${alerta.humedad}%`);
}

// ---------------------------------------------------------
// Conexión a RabbitMQ
// ---------------------------------------------------------
async function iniciar() {
  try {
    const conexion = await amqp.connect(RABBITMQ_URL);
    const canal    = await conexion.createChannel();

    await canal.assertExchange(EXCHANGE_ALERTAS, 'fanout', { durable: true });
    await canal.assertQueue(QUEUE, { durable: true });
    await canal.bindQueue(QUEUE, EXCHANGE_ALERTAS, '');

    console.log(`[NOTIFICACIONES] Suscrito al exchange "${EXCHANGE_ALERTAS}" → cola "${QUEUE}"`);
    console.log(`[NOTIFICACIONES] Notificaciones se enviarán a: ${CORREO_DESTINO}`);
    console.log('[NOTIFICACIONES] Esperando alertas...');

    canal.consume(QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const alerta = JSON.parse(msg.content.toString());
        console.log(`\n[NOTIFICACIONES] Alerta recibida | Sensor: ${alerta.sensorId} | Nivel: ${alerta.nivel}`);

        await enviarCorreo(alerta);

        canal.ack(msg);

      } catch (err) {
        console.error('[NOTIFICACIONES] Error procesando alerta:', err.message);
        canal.nack(msg, false, false);
      }
    });

    conexion.on('close', () => {
      console.warn('[NOTIFICACIONES] Conexión RabbitMQ cerrada. Reintentando en 3s...');
      setTimeout(iniciar, 3000);
    });

  } catch (err) {
    console.error('[NOTIFICACIONES] Error al iniciar:', err.message);
    setTimeout(iniciar, 3000);
  }
}

iniciar();