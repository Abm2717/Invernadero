/**
 * SERVICIO SENSORES
 * 
 * Responsabilidades:
 * 1. Exponer API REST para gestionar sensores (CRUD)
 * 2. Guardar y consultar sensores directamente en PostgreSQL
 * 
 * Endpoints:
 *   POST   /sensores          → registrar sensor
 *   GET    /sensores          → listar todos los sensores
 *   GET    /sensores/:id      → obtener sensor por ID
 *   PUT    /sensores/:id      → actualizar sensor
 *   DELETE /sensores/:id      → eliminar sensor
 */

const express    = require('express');
const cors       = require('cors');
const { Sequelize, DataTypes } = require('sequelize');

const HTTP_PORT = 8001;

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
// Modelo Sensor
// ---------------------------------------------------------
const Sensor = sequelize.define('Sensor', {
  nombre: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ubicacion: {
    type: DataTypes.STRING,
    allowNull: false
  },
  marca: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tipo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  umbralTemperatura: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 35
  },
  umbralHumedad: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 85
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'sensores',
  timestamps: true
});

// ---------------------------------------------------------
// API REST
// ---------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// POST /sensores - registrar sensor
app.post('/sensores', async (req, res) => {
  try {
    const sensor = await Sensor.create(req.body);
    console.log(`[SENSORES] Sensor registrado ✓ | ID: ${sensor.id} | Nombre: ${sensor.nombre}`);
    res.status(201).json(sensor);
  } catch (err) {
    console.error('[SENSORES] Error registrando sensor:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// GET /sensores - listar todos
app.get('/sensores', async (req, res) => {
  try {
    const sensores = await Sensor.findAll();
    res.json({ total: sensores.length, sensores });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /sensores/:id - obtener por ID
app.get('/sensores/:id', async (req, res) => {
  try {
    const sensor = await Sensor.findByPk(req.params.id);
    if (!sensor) return res.status(404).json({ error: 'Sensor no encontrado' });
    res.json(sensor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /sensores/:id - actualizar
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

// DELETE /sensores/:id - eliminar
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

    app.listen(HTTP_PORT, () => {
      console.log(`[SENSORES] API REST disponible en http://localhost:${HTTP_PORT}`);
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