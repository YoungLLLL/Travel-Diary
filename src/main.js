import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useTripsStore } from './stores/trips'
import { supabase } from './lib/supabase'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 初始化 auth 状态，然后再挂载
const auth = useAuthStore()
auth.init().then(() => {
  app.mount('#app')
})

// 登录状态变化时，自动加载/清空行程
supabase.auth.onAuthStateChange((event, session) => {
  const tripsStore = useTripsStore()
  if (session?.user) {
    tripsStore.fetchTrips()
  } else {
    tripsStore.trips = []
  }
})
