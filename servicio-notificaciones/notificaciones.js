/**
 * SERVICIO NOTIFICACIONES
 * 
 * Responsabilidades:
 * 1. Exponer API REST para gestionar suscripciones de alertas
 * 2. Suscribirse al exchange de alertas de RabbitMQ
 * 3. Consultar suscriptores en BD y enviar correos reales via Gmail
 * 
 * Endpoints:
 *   POST   /notificaciones/suscribir          → registrar suscripción
 *   GET    /notificaciones/suscripciones       → listar suscripciones
 *   DELETE /notificaciones/suscripciones/:id   → eliminar suscripción
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const amqp       = require('amqplib');
const nodemailer = require('nodemailer');
const express    = require('express');
const cors       = require('cors');
const { Sequelize, DataTypes } = require('sequelize');

const HTTP_PORT        = 8002;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_ALERTAS = 'invernadero.alertas';
const QUEUE            = 'notificaciones.alertas';

// ---------------------------------------------------------
// Conexión a PostgreSQL
// ---------------------------------------------------------
const sequelize = new Sequelize('postgresql://postgres.lfezbkxzdwanrvvxqibk:ItSoN242717_@aws-1-us-east-1.pooler.supabase.com:6543/postgres', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false
});

// ---------------------------------------------------------
// Modelo Suscripcion
// ---------------------------------------------------------
const Suscripcion = sequelize.define('Suscripcion', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  correo: {
    type: DataTypes.STRING,
    allowNull: false
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'suscripciones',
  timestamps: true
});

// ---------------------------------------------------------
// Configuración de correo Gmail
// ---------------------------------------------------------
const CORREO_ORIGEN  = 'invernadero.alertas@gmail.com';
const CONTRASENA_APP = 'sqgv tysl rbiq krku';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: CORREO_ORIGEN,
    pass: CONTRASENA_APP
  }
});

// ---------------------------------------------------------
// Enviar correo a todos los suscriptores activos
// Los umbrales ya fueron validados por el Servicio Alertas
// ---------------------------------------------------------
async function enviarCorreos(alerta) {
  const suscriptores = await Suscripcion.findAll({ where: { activo: true } });

  if (suscriptores.length === 0) {
    console.log('[NOTIFICACIONES] Sin suscriptores activos, no se envían correos');
    return;
  }

  for (const suscriptor of suscriptores) {
    const asunto = `🚨 Alerta Invernadero - Sensor ${alerta.sensorId} - Nivel ${alerta.nivel}`;
    const cuerpo = `
Hola ${suscriptor.nombre},

Se ha detectado una alerta en el sistema de monitoreo de invernadero.

Detalles:
- Sensor ID:    ${alerta.sensorId}
- Temperatura:  ${alerta.temperatura}°C
- Humedad:      ${alerta.humedad}%
- Nivel:        ${alerta.nivel}
- Motivo:       ${alerta.motivo}
- Timestamp:    ${alerta.timestamp}

Por favor tome las medidas necesarias.

Sistema de Monitoreo de Invernadero
    `;

    await transporter.sendMail({
      from:    CORREO_ORIGEN,
      to:      suscriptor.correo,
      subject: asunto,
      text:    cuerpo
    });

    console.log(`[NOTIFICACIONES] ✉ Correo enviado → ${suscriptor.nombre} (${suscriptor.correo})`);
  }
}

// ---------------------------------------------------------
// API REST para suscripciones
// ---------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// POST /notificaciones/suscribir
app.post('/notificaciones/suscribir', async (req, res) => {
  try {
    const suscripcion = await Suscripcion.create(req.body);
    console.log(`[NOTIFICACIONES] Suscripción registrada ✓ | ${suscripcion.nombre} - ${suscripcion.correo}`);
    res.status(201).json(suscripcion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /notificaciones/suscripciones
app.get('/notificaciones/suscripciones', async (req, res) => {
  try {
    const suscripciones = await Suscripcion.findAll();
    res.json({ total: suscripciones.length, suscripciones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /notificaciones/suscripciones/:id
app.delete('/notificaciones/suscripciones/:id', async (req, res) => {
  try {
    const suscripcion = await Suscripcion.findByPk(req.params.id);
    if (!suscripcion) return res.status(404).json({ error: 'Suscripción no encontrada' });
    await suscripcion.destroy();
    console.log(`[NOTIFICACIONES] Suscripción eliminada ✓ | ID: ${req.params.id}`);
    res.json({ mensaje: 'Suscripción eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// Iniciar todo
// ---------------------------------------------------------
async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('[NOTIFICACIONES] Conectado a PostgreSQL');
    await sequelize.sync({ alter: true });
    console.log('[NOTIFICACIONES] Tabla suscripciones lista');

    app.listen(HTTP_PORT, () => {
      console.log(`[NOTIFICACIONES] API REST en http://localhost:${HTTP_PORT}`);
      console.log(`[NOTIFICACIONES] Endpoints:`);
      console.log(`           POST   /notificaciones/suscribir`);
      console.log(`           GET    /notificaciones/suscripciones`);
      console.log(`           DELETE /notificaciones/suscripciones/:id`);
    });

    const conexion = await amqp.connect(RABBITMQ_URL);
    const canal    = await conexion.createChannel();

    await canal.assertExchange(EXCHANGE_ALERTAS, 'fanout', { durable: true });
    await canal.assertQueue(QUEUE, { durable: true });
    await canal.bindQueue(QUEUE, EXCHANGE_ALERTAS, '');

    console.log(`[NOTIFICACIONES] Suscrito al exchange "${EXCHANGE_ALERTAS}"`);
    console.log('[NOTIFICACIONES] Esperando alertas...');

    canal.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const alerta = JSON.parse(msg.content.toString());
        console.log(`\n[NOTIFICACIONES] Alerta recibida | Sensor: ${alerta.sensorId} | Nivel: ${alerta.nivel}`);
        await enviarCorreos(alerta);
        canal.ack(msg);
      } catch (err) {
        console.error('[NOTIFICACIONES] Error:', err.message);
        canal.nack(msg, false, false);
      }
    });

    conexion.on('close', () => {
      console.warn('[NOTIFICACIONES] RabbitMQ cerrado. Reintentando en 3s...');
      setTimeout(iniciar, 3000);
    });

  } catch (err) {
    console.error('[NOTIFICACIONES] Error al iniciar:', err.message);
    setTimeout(iniciar, 3000);
  }
}

iniciar();