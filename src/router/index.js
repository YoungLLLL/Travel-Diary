import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/trip/:id',
      name: 'trip',
      component: () => import('../views/TripPlanView.vue'),
    },
    {
      path: '/trip/:id/bill',
      name: 'trip-bill',
      component: () => import('../views/BillView.vue'),
    },
  ],
})

export default router
