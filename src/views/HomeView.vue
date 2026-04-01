<template>
  <div class="home">
    <header class="home-header">
      <h1>Travel Diary</h1>
      <button class="btn-primary" @click="showCreateModal = true">+ 新建旅行计划</button>
    </header>

    <div v-if="trips.length === 0" class="empty-state">
      <p>还没有旅行计划，开始规划你的第一次旅行吧！</p>
    </div>

    <div v-else class="trip-list">
      <div v-for="trip in trips" :key="trip.id" class="trip-card" @click="goToTrip(trip.id)">
        <div class="trip-card-info">
          <h2>{{ trip.name }}</h2>
          <p>{{ trip.startDate }} ~ {{ trip.endDate }}</p>
          <p class="trip-days">共 {{ trip.days.length }} 天</p>
        </div>
        <button class="btn-delete" @click.stop="deleteTrip(trip.id)">删除</button>
      </div>
    </div>

    <!-- 新建计划弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h2>新建旅行计划</h2>
        <form @submit.prevent="createTrip">
          <div class="form-group">
            <label>计划名称</label>
            <input v-model="form.name" type="text" placeholder="如：日本关西 7 日游" required />
          </div>
          <div class="form-group">
            <label>出发日期</label>
            <input v-model="form.startDate" type="date" required />
          </div>
          <div class="form-group">
            <label>结束日期</label>
            <input v-model="form.endDate" type="date" required />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="showCreateModal = false">取消</button>
            <button type="submit" class="btn-primary">创建</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTripsStore } from '../stores/trips'
import { storeToRefs } from 'pinia'

const router = useRouter()
const store = useTripsStore()
const { trips } = storeToRefs(store)

const showCreateModal = ref(false)
const form = ref({ name: '', startDate: '', endDate: '' })

function goToTrip(id) {
  router.push({ name: 'trip', params: { id } })
}

function createTrip() {
  if (!form.value.name || !form.value.startDate || !form.value.endDate) return
  const id = store.createTrip(form.value.name, form.value.startDate, form.value.endDate)
  showCreateModal.value = false
  form.value = { name: '', startDate: '', endDate: '' }
  router.push({ name: 'trip', params: { id } })
}

function deleteTrip(id) {
  if (confirm('确定要删除这个旅行计划吗？')) {
    store.deleteTrip(id)
  }
}
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.home-header h1 {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
}

.empty-state {
  text-align: center;
  padding: 80px 0;
  color: #888;
  font-size: 16px;
}

.trip-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trip-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.trip-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.trip-card-info h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.trip-card-info p {
  font-size: 14px;
  color: #666;
}

.trip-days {
  margin-top: 4px;
  color: #888 !important;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-delete {
  background: none;
  border: 1px solid #e5e5e5;
  color: #999;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-delete:hover {
  border-color: #f87171;
  color: #ef4444;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 420px;
  max-width: 90vw;
}

.modal h2 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
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
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>
