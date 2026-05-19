<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo">
        <span class="icon">🌱</span>
        <h1>Invernadero</h1>
        <p>Sistema de Monitoreo</p>
      </div>

      <form @submit.prevent="login">
        <div class="field">
          <label>Usuario</label>
          <input v-model="username" type="text" placeholder="dueño" required />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? 'Iniciando sesión...' : 'Iniciar sesión' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'LoginView',
  data() {
    return {
      username: '',
      password: '',
      error: '',
      loading: false
    }
  },
  methods: {
    async login() {
      this.loading = true
      this.error = ''
      try {
        const params = new URLSearchParams()
        params.append('grant_type', 'password')
        params.append('client_id', 'api-gateway')
        params.append('client_secret', 'nRbuJ9bxr2Acgb0XyqY5iaviqhDooIn1')
        params.append('username', this.username)
        params.append('password', this.password)

        const response = await axios.post(
          `http://${window.location.hostname}:8080/realms/Invernadero/protocol/openid-connect/token`,
          params
        )

        localStorage.setItem('token', response.data.access_token)
        this.$router.push('/dashboard')
      } catch (err) {
        this.error = 'Usuario o contraseña incorrectos'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 40px;
  width: 360px;
  color: white;
}

.logo {
  text-align: center;
  margin-bottom: 30px;
}

.icon {
  font-size: 48px;
}

h1 {
  margin: 10px 0 4px;
  font-size: 24px;
}

p {
  color: rgba(255,255,255,0.5);
  font-size: 14px;
}

.field {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  margin-bottom: 6px;
}

input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.08);
  color: white;
  font-size: 14px;
  box-sizing: border-box;
}

input::placeholder {
  color: rgba(255,255,255,0.3);
}

button {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: none;
  background: #4caf50;
  color: white;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.2s;
}

button:hover {
  background: #43a047;
}

button:disabled {
  background: #555;
  cursor: not-allowed;
}

.error {
  color: #ff6b6b;
  font-size: 13px;
  text-align: center;
  margin-bottom: 8px;
}
</style>