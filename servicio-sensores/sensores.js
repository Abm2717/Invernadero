/**
 * SERVICIO SENSORES
 * 
 * Responsabilidades:
 * 1. Exponer API REST para gestionar sensores (CRUD)
 * 2. Exponer servidor gRPC para que otros microservicios consulten sensores
 * 
 * Endpoints REST:
 *   POST   /sensores          → registrar sensor
 *   GET    /sensores          → listar todos los sensores
 *   GET    /sensores/:id      → obtener sensor por ID
 *   PUT    /sensores/:id      → actualizar sensor
 *   DELETE /sensores/:id      → eliminar sensor
 * 
 * gRPC:
 *   ObtenerSensor(id) → devuelve datos del sensor incluyendo umbrales
 */

const express    = require('express');
const cors       = require('cors');
const grpc       = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path       = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const HTTP_PORT = 8001;
const GRPC_PORT = 50051;

// ---------------------------------------------------------
// Conexión a PostgreSQL
// ---------------------------------------------------------
const sequelize = new Sequelize('postgresql://postgres:ItSoN242717_@db.lfezbkxzdwanrvvxqibk.supabase.co:5432/postgres', {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false
});

// ---------------------------------------------------------
// Modelo Sensor
// ---------------------------------------------------------
const Sensor = sequelize.define('Sensor', {
  nombre:            { type: DataTypes.STRING,  allowNull: false },
  ubicacion:         { type: DataTypes.STRING,  allowNull: false },
  marca:             { type: DataTypes.STRING,  allowNull: true  },
  tipo:              { type: DataTypes.STRING,  allowNull: true  },
  umbralTemperatura: { type: DataTypes.FLOAT,   allowNull: true, defaultValue: 35 },
  umbralHumedad:     { type: DataTypes.FLOAT,   allowNull: true, defaultValue: 85 },
  activo:            { type: DataTypes.BOOLEAN, defaultValue: true }
}, {
  tableName: 'sensores',
  timestamps: true
});

// ---------------------------------------------------------
// Servidor gRPC
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

async function obtenerSensor(call, callback) {
  try {
    const sensor = await Sensor.findByPk(call.request.id);
    if (!sensor) {
      console.log(`[SENSORES gRPC] Sensor ID ${call.request.id} no encontrado`);
      return callback(null, { encontrado: false });
    }
    console.log(`[SENSORES gRPC] Sensor consultado | ID: ${sensor.id} | Umbrales: Temp ${sensor.umbralTemperatura}°C | Hum ${sensor.umbralHumedad}%`);
    callback(null, {
      id:                 sensor.id,
      nombre:             sensor.nombre,
      ubicacion:          sensor.ubicacion,
      marca:              sensor.marca || '',
      tipo:               sensor.tipo  || '',
      umbralTemperatura:  sensor.umbralTemperatura,
      umbralHumedad:      sensor.umbralHumedad,
      activo:             sensor.activo,
      encontrado:         true
    });
  } catch (err) {
    console.error('[SENSORES gRPC] Error:', err.message);
    callback(err);
  }
}

function iniciarGRPC() {
  const server = new grpc.Server();
  server.addService(proto.SensorService.service, { ObtenerSensor: obtenerSensor });
  server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('[SENSORES gRPC] Error al iniciar:', err.message);
      return;
    }
    console.log(`[SENSORES gRPC] Servidor gRPC en puerto ${port}`);
  });
}

// ---------------------------------------------------------
// API REST
// ---------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

app.post('/sensores', async (req, res) => {
  try {
    const sensor = await Sensor.create(req.body);
    console.log(`[SENSORES] Sensor registrado ✓ | ID: ${sensor.id} | Nombre: ${sensor.nombre}`);
    res.status(201).json(sensor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/sensores', async (req, res) => {
  try {
    const sensores = await Sensor.findAll();
    res.json({ total: sensores.length, sensores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sensores/:id', async (req, res) => {
  try {
    const sensor = await Sensor.findByPk(req.params.id);
    if (!sensor) return res.status(404).json({ error: 'Sensor no encontrado' });
    res.json(sensor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/sensores/:id', async (req, res) => {
  try {
    const sensor = await Sensor.findByPk(req.params.id);
    if (!sensor) return res.status(404).json({ error: 'Sensor no encontrado' });
    await sensor.update(req.body);
    console.log(`[SENSORES] Sensor actualizado ✓ | ID: ${sensor.id}`);
    res.json(sensor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/sensores/:id', async (req, res) => {
  try {
    const sensor = await Sensor.findByPk(req.params.id);
    if (!sensor) return res.status(404).json({ error: 'Sensor no encontrado' });
    await sensor.destroy();
    console.log(`[SENSORES] Sensor eliminado ✓ | ID: ${req.params.id}`);
    res.json({ mensaje: 'Sensor eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------
// Arranque
// ---------------------------------------------------------
async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('[SENSORES] Conectado a PostgreSQL');
    await sequelize.sync({ alter: true });
    console.log('[SENSORES] Tabla sensores lista');

    iniciarGRPC();

    app.listen(HTTP_PORT, () => {
      console.log(`[SENSORES] API REST en http://localhost:${HTTP_PORT}`);
      console.log(`[SENSORES] Endpoints:`);
      console.log(`           POST   /sensores`);
      console.log(`           GET    /sensores`);
      console.log(`           GET    /sensores/:id`);
      console.log(`           PUT    /sensores/:id`);
      console.log(`           DELETE /sensores/:id`);
    });
  } catch (err) {
    console.error('[SENSORES] Error al iniciar:', err.message);
    setTimeout(iniciar, 3000);
  }
}

iniciar();