<template>
  <div class="page">
    <nav>
      <div class="brand">🌱 Invernadero</div>
      <div class="links">
        <router-link to="/dashboard">Dashboard</router-link>
        <router-link to="/sensores">Sensores</router-link>
        <router-link to="/suscripciones">Notificaciones</router-link>
        <button @click="logout">Cerrar sesión</button>
      </div>
    </nav>

    <div class="content">
      <div class="header">
        <h2>Gestión de Sensores</h2>
        <button class="btn-add" @click="mostrarFormulario = true">+ Agregar Sensor</button>
      </div>

      <!-- Formulario -->
      <div v-if="mostrarFormulario" class="modal">
        <div class="modal-card">
          <h3>{{ editando ? 'Editar Sensor' : 'Nuevo Sensor' }}</h3>
          <div class="field">
            <label>Nombre</label>
            <input v-model="form.nombre" placeholder="Sensor A1" />
          </div>
          <div class="field">
            <label>Ubicación</label>
            <input v-model="form.ubicacion" placeholder="Invernadero 1" />
          </div>
          <div class="field">
            <label>Marca</label>
            <input v-model="form.marca" placeholder="DHT22" />
          </div>
          <div class="field">
            <label>Tipo</label>
            <input v-model="form.tipo" placeholder="temperatura-humedad" />
          </div>
          <div class="field">
            <label>Umbral Temperatura (°C)</label>
            <input v-model.number="form.umbralTemperatura" type="number" placeholder="35" />
          </div>
          <div class="field">
            <label>Umbral Humedad (%)</label>
            <input v-model.number="form.umbralHumedad" type="number" placeholder="85" />
          </div>
          <div class="modal-actions">
            <button class="btn-cancel" @click="cancelar">Cancelar</button>
            <button class="btn-save" @click="guardar">{{ editando ? 'Actualizar' : 'Guardar' }}</button>
          </div>
        </div>
      </div>

      <!-- Tabla -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Ubicación</th>
              <th>Marca</th>
              <th>Umbral Temp</th>
              <th>Umbral Hum</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sensor in sensores" :key="sensor.id">
              <td>{{ sensor.id }}</td>
              <td>{{ sensor.nombre }}</td>
              <td>{{ sensor.ubicacion }}</td>
              <td>{{ sensor.marca }}</td>
              <td>{{ sensor.umbralTemperatura }}°C</td>
              <td>{{ sensor.umbralHumedad }}%</td>
              <td>
                <span :class="sensor.activo ? 'badge-activo' : 'badge-inactivo'">
                  {{ sensor.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td>
                <button class="btn-edit" @click="editar(sensor)">Editar</button>
                <button class="btn-delete" @click="eliminar(sensor.id)">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="sensores.length === 0" class="empty">No hay sensores registrados</p>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

const BASE = `http://${window.location.hostname}:8081`
const API = `${BASE}/sensores`

export default {
  name: 'SensoresView',
  data() {
    return {
      sensores: [],
      mostrarFormulario: false,
      editando: false,
      form: {
        id: null,
        nombre: '',
        ubicacion: '',
        marca: '',
        tipo: '',
        umbralTemperatura: 35,
        umbralHumedad: 85
      }
    }
  },
  mounted() {
    this.cargarSensores()
  },
  methods: {
    headers() {
      return { Authorization: `Bearer ${localStorage.getItem('token')}` }
    },
    async cargarSensores() {
      try {
        const res = await axios.get(API, { headers: this.headers() })
        this.sensores = res.data.sensores
      } catch {
        this.sensores = []
      }
    },
    async guardar() {
      try {
        if (this.editando) {
          await axios.put(`${API}/${this.form.id}`, this.form, { headers: this.headers() })
        } else {
          await axios.post(API, this.form, { headers: this.headers() })
        }
        this.cancelar()
        this.cargarSensores()
      } catch (err) {
        alert('Error al guardar sensor')
      }
    },
    editar(sensor) {
      this.form = { ...sensor }
      this.editando = true
      this.mostrarFormulario = true
    },
    async eliminar(id) {
      if (!confirm('¿Eliminar este sensor?')) return
      await axios.delete(`${API}/${id}`, { headers: this.headers() })
      this.cargarSensores()
    },
    cancelar() {
      this.mostrarFormulario = false
      this.editando = false
      this.form = { id: null, nombre: '', ubicacion: '', marca: '', tipo: '', umbralTemperatura: 35, umbralHumedad: 85 }
    },
    logout() {
      localStorage.removeItem('token')
      this.$router.push('/login')
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; background: #0f0f1a; color: white; }

nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 32px; background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.brand { font-size: 20px; font-weight: bold; color: #4caf50; }
.links { display: flex; align-items: center; gap: 24px; }
.links a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; }
.links a:hover, .links a.router-link-active { color: #4caf50; }
.links button {
  padding: 8px 16px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);
  background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 14px;
}

.content { padding: 32px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
h2 { margin: 0; }

.btn-add {
  padding: 10px 20px; border-radius: 8px; border: none;
  background: #4caf50; color: white; cursor: pointer; font-weight: bold;
}

.table-container {
  background: rgba(255,255,255,0.05); border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1); overflow: hidden;
}
table { width: 100%; border-collapse: collapse; }
th { padding: 14px 16px; text-align: left; font-size: 13px; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); }
td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }

.badge-activo { background: rgba(76,175,80,0.2); color: #4caf50; padding: 4px 10px; border-radius: 20px; font-size: 12px; }
.badge-inactivo { background: rgba(255,107,107,0.2); color: #ff6b6b; padding: 4px 10px; border-radius: 20px; font-size: 12px; }

.btn-edit { padding: 6px 12px; border-radius: 6px; border: none; background: rgba(33,150,243,0.2); color: #2196f3; cursor: pointer; margin-right: 8px; }
.btn-delete { padding: 6px 12px; border-radius: 6px; border: none; background: rgba(255,107,107,0.2); color: #ff6b6b; cursor: pointer; }

.empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); }

.modal {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100;
}
.modal-card {
  background: #1a1a2e; border-radius: 16px; padding: 32px; width: 400px;
  border: 1px solid rgba(255,255,255,0.1);
}
h3 { margin: 0 0 20px; }
.field { margin-bottom: 14px; }
label { display: block; font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
input {
  width: 100%; padding: 10px 14px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08);
  color: white; font-size: 14px; box-sizing: border-box;
}
.modal-actions { display: flex; gap: 12px; margin-top: 20px; }
.btn-cancel {
  flex: 1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
  background: transparent; color: white; cursor: pointer;
}
.btn-save {
  flex: 1; padding: 10px; border-radius: 8px; border: none;
  background: #4caf50; color: white; cursor: pointer; font-weight: bold;
}
</style>