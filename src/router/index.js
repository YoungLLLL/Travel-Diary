import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/AuthView.vue'),
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: true },
    },
    {
      path: '/trip/:id',
      name: 'trip',
      component: () => import('../views/TripPlanView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/trip/:id/bill',
      name: 'trip-bill',
      component: () => import('../views/BillView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/trip/:id/export',
      name: 'trip-export',
      component: () => import('../views/TripExportView.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // 等待 auth 初始化完成
  if (auth.loading) {
    await new Promise(resolve => {
      const stop = setInterval(() => {
        if (!auth.loading) { clearInterval(stop); resolve() }
      }, 50)
    })
  }
  if (to.meta.requiresAuth && !auth.user) return { name: 'login' }
  if (to.name === 'login' && auth.user) return { name: 'home' }
})

export default router
