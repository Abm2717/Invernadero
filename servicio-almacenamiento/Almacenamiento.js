/**
 * SERVICIO ALMACENAMIENTO
 * 
 * Responsabilidades:
 * 1. Suscribirse al exchange de mediciones (invernadero)
 *    → Guardar en tabla mediciones
 * 2. Suscribirse al exchange de alertas (invernadero.alertas)
 *    → Guardar en tabla notificaciones
 */

const amqp      = require('amqplib');
const { Sequelize, DataTypes } = require('sequelize');

const RABBITMQ_URL     = 'amqp://localhost';
const EXCHANGE         = 'invernadero';
const EXCHANGE_ALERTAS = 'invernadero.alertas';
const QUEUE_MEDICIONES    = 'almacenamiento.mediciones';
const QUEUE_NOTIFICACIONES = 'almacenamiento.notificaciones';

// ---------------------------------------------------------
// Conexión a PostgreSQL
// ---------------------------------------------------------
const sequelize = new Sequelize('postgresql://postgres:ItSoN242717_@db.lfezbkxzdwanrvvxqibk.supabase.co:5432/postgres', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

// ---------------------------------------------------------
// Modelo Medicion
// ---------------------------------------------------------
const Medicion = sequelize.define('Medicion', {
  sensorId:    { type: DataTypes.INTEGER, allowNull: false },
  temperatura: { type: DataTypes.FLOAT,   allowNull: false },
  humedad:     { type: DataTypes.FLOAT,   allowNull: false },
  timestamp:   { type: DataTypes.DATE,    allowNull: false },
  raw:         { type: DataTypes.STRING,  allowNull: true  }
}, {
  tableName: 'mediciones',
  timestamps: false
});

// ---------------------------------------------------------
// Modelo Notificacion
// ---------------------------------------------------------
const Notificacion = sequelize.define('Notificacion', {
  sensorId:    { type: DataTypes.INTEGER, allowNull: false },
  temperatura: { type: DataTypes.FLOAT,   allowNull: false },
  humedad:     { type: DataTypes.FLOAT,   allowNull: false },
  nivel:       { type: DataTypes.STRING,  allowNull: false },
  motivo:      { type: DataTypes.TEXT,    allowNull: false },
  timestamp:   { type: DataTypes.DATE,    allowNull: false }
}, {
  tableName: 'notificaciones',
  timestamps: false
});

// ---------------------------------------------------------
// Conexión a RabbitMQ y consumo de mensajes
// ---------------------------------------------------------
async function iniciar() {
  try {
    // Conectar a PostgreSQL
    await sequelize.authenticate();
    console.log('[ALMACENAMIENTO] Conectado a PostgreSQL');
    await sequelize.sync({ alter: true });
    console.log('[ALMACENAMIENTO] Tablas listas: mediciones, notificaciones');

    // Conectar a RabbitMQ
    const conexion = await amqp.connect(RABBITMQ_URL);
    const canal    = await conexion.createChannel();

    // --- Cola de mediciones ---
    await canal.assertExchange(EXCHANGE, 'fanout', { durable: true });
    await canal.assertQueue(QUEUE_MEDICIONES, { durable: true });
    await canal.bindQueue(QUEUE_MEDICIONES, EXCHANGE, '');

    // --- Cola de notificaciones ---
    await canal.assertExchange(EXCHANGE_ALERTAS, 'fanout', { durable: true });
    await canal.assertQueue(QUEUE_NOTIFICACIONES, { durable: true });
    await canal.bindQueue(QUEUE_NOTIFICACIONES, EXCHANGE_ALERTAS, '');

    console.log(`[ALMACENAMIENTO] Suscrito a "${EXCHANGE}" → cola "${QUEUE_MEDICIONES}"`);
    console.log(`[ALMACENAMIENTO] Suscrito a "${EXCHANGE_ALERTAS}" → cola "${QUEUE_NOTIFICACIONES}"`);
    console.log('[ALMACENAMIENTO] Esperando mensajes...');

    // Consumir mediciones
    canal.consume(QUEUE_MEDICIONES, async (msg) => {
      if (!msg) return;
      try {
        const medicion = JSON.parse(msg.content.toString());
        await Medicion.create({
          sensorId:    medicion.sensorId,
          temperatura: medicion.temperatura,
          humedad:     medicion.humedad,
          timestamp:   new Date(medicion.timestamp),
          raw:         medicion.raw
        });
        console.log(`[ALMACENAMIENTO] Medicion guardada ✓ | Sensor: ${medicion.sensorId} | Temp: ${medicion.temperatura}°C | Humedad: ${medicion.humedad}%`);
        canal.ack(msg);
      } catch (err) {
        console.error('[ALMACENAMIENTO] Error guardando medición:', err.message);
        canal.nack(msg, false, false);
      }
    });

    // Consumir notificaciones
    canal.consume(QUEUE_NOTIFICACIONES, async (msg) => {
      if (!msg) return;
      try {
        const alerta = JSON.parse(msg.content.toString());
        await Notificacion.create({
          sensorId:    alerta.sensorId,
          temperatura: alerta.temperatura,
          humedad:     alerta.humedad,
          nivel:       alerta.nivel,
          motivo:      alerta.motivo,
          timestamp:   new Date(alerta.timestamp)
        });
        console.log(`[ALMACENAMIENTO] Notificacion guardada ✓ | Sensor: ${alerta.sensorId} | Nivel: ${alerta.nivel}`);
        canal.ack(msg);
      } catch (err) {
        console.error('[ALMACENAMIENTO] Error guardando notificación:', err.message);
        canal.nack(msg, false, false);
      }
    });

    conexion.on('close', () => {
      console.warn('[ALMACENAMIENTO] Conexión RabbitMQ cerrada. Reintentando en 3s...');
      setTimeout(iniciar, 3000);
    });

  } catch (err) {
    console.error('[ALMACENAMIENTO] Error al iniciar:', err.message);
    setTimeout(iniciar, 3000);
  }
}

iniciar();