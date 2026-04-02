<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1 class="auth-title">Travel Diary</h1>
      <p class="auth-sub">{{ isLogin ? '登录以同步你的行程' : '创建账号' }}</p>

      <form @submit.prevent="submit">
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="you@example.com" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="至少 6 位" required autocomplete="current-password" />
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '请稍候...' : (isLogin ? '登录' : '注册') }}
        </button>
      </form>

      <button class="btn-switch" @click="toggle">
        {{ isLogin ? '还没有账号？点此注册' : '已有账号？点此登录' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isLogin = ref(true)
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

function toggle() {
  isLogin.value = !isLogin.value
  errorMsg.value = ''
  successMsg.value = ''
}

async function submit() {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  try {
    if (isLogin.value) {
      await auth.signIn(email.value, password.value)
      router.push('/')
    } else {
      await auth.signUp(email.value, password.value)
      successMsg.value = '注册成功！请检查邮箱确认链接，然后回来登录。'
      isLogin.value = true
    }
  } catch (e) {
    const msg = e.message || ''
    if (msg.includes('Invalid login credentials')) errorMsg.value = '邮箱或密码错误'
    else if (msg.includes('User already registered')) errorMsg.value = '该邮箱已注册，请直接登录'
    else if (msg.includes('Password should be')) errorMsg.value = '密码至少需要 6 位'
    else errorMsg.value = msg || '操作失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.auth-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px;
  width: 380px;
  max-width: 90vw;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}

.auth-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 6px;
  color: #1a1a1a;
}

.auth-sub {
  font-size: 14px;
  color: #888;
  margin: 0 0 28px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #555;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
}

.form-group input:focus {
  border-color: #2563eb;
}

.btn-submit {
  width: 100%;
  padding: 11px;
  background: #1a1a1a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
}

.btn-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-switch {
  display: block;
  width: 100%;
  margin-top: 16px;
  background: none;
  border: none;
  color: #2563eb;
  font-size: 13px;
  cursor: pointer;
  text-align: center;
}

.error-msg {
  color: #ef4444;
  font-size: 13px;
  margin: 8px 0 0;
}

.success-msg {
  color: #16a34a;
  font-size: 13px;
  margin: 8px 0 0;
}
</style>
