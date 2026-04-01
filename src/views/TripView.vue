<template>
  <div v-if="trip" class="trip-view">
    <!-- 顶部导航 -->
    <header class="trip-header">
      <button class="btn-back" @click="router.push('/')">← 返回</button>
      <h1>{{ trip.name }}</h1>
      <div class="header-tabs">
        <button class="tab active">日程</button>
        <button class="tab" @click="router.push({ name: 'trip-map', params: { id } })">地图</button>
        <button class="tab" @click="router.push({ name: 'trip-bill', params: { id } })">账单</button>
      </div>
    </header>

    <div class="trip-content">
      <!-- 准备清单 -->
      <div class="checklist-section">
        <button class="checklist-toggle" @click="checklistOpen = !checklistOpen">
          <span>准备清单</span>
          <span>{{ checklistOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-if="checklistOpen" class="checklist-body">
          <div v-for="item in trip.checklist" :key="item.id" class="checklist-item">
            <input type="checkbox" :checked="item.done" @change="store.toggleChecklistItem(id, item.id)" />
            <span :class="{ done: item.done }">{{ item.text }}</span>
            <button class="btn-icon" @click="store.deleteChecklistItem(id, item.id)">×</button>
          </div>
          <div class="checklist-add">
            <input
              v-model="newChecklistItem"
              type="text"
              placeholder="添加清单项..."
              @keyup.enter="addChecklistItem"
            />
            <button class="btn-small" @click="addChecklistItem">添加</button>
          </div>
        </div>
      </div>

      <!-- 每日行程 -->
      <div v-for="day in trip.days" :key="day.id" class="day-section">
        <div class="day-header">
          <div class="day-title">
            <span class="day-label">Day {{ day.index }}</span>
            <span class="day-date">{{ day.date }}</span>
          </div>
          <input
            v-model="day.theme"
            type="text"
            class="day-theme-input"
            placeholder="设置今日主题..."
            @change="store.save && store.save()"
            @blur="saveTrip"
          />
        </div>

        <!-- 每日备注 -->
        <div class="day-notes-section">
          <div class="day-notes-header" @click="toggleDayNotes(day.id)">
            <span class="notes-toggle">{{ expandedDayNotes.has(day.id) ? '▼' : '▶' }}</span>
            <span class="notes-label">备注 ({{ day.notes?.length || 0 }})</span>
          </div>
          <div v-if="expandedDayNotes.has(day.id)" class="day-notes-content">
            <ul class="notes-list">
              <li v-for="note in day.notes" :key="note.id" class="note-item">
                <input
                  type="checkbox"
                  :checked="note.done"
                  @change="store.toggleDayNote(id, day.id, note.id)"
                />
                <span :class="{ 'note-done': note.done }">{{ note.text }}</span>
                <button class="btn-icon" @click="store.deleteDayNote(id, day.id, note.id)">×</button>
              </li>
            </ul>
            <div class="add-note-input">
              <input
                v-model="newDayNote"
                type="text"
                placeholder="添加备注..."
                @keyup.enter="addDayNote(day.id)"
              />
              <button class="btn-small" @click="addDayNote(day.id)">添加</button>
            </div>
          </div>
        </div>

        <!-- 景点列表 -->
        <div class="spots-list">
          <template v-for="(spot, idx) in day.spots" :key="spot.id">
            <div class="spot-card">
              <div class="spot-header" @click="toggleSpot(spot.id)">
                <div class="spot-basic">
                  <input
                    v-model="spot.time"
                    type="time"
                    class="spot-time"
                    @click.stop
                    @change="saveTrip"
                  />
                  <span class="spot-name">{{ spot.name || '未命名景点' }}</span>
                </div>
                <span class="spot-toggle">{{ expandedSpots.has(spot.id) ? '▲' : '▼' }}</span>
              </div>

              <div v-if="expandedSpots.has(spot.id)" class="spot-detail">
                <div class="form-row">
                  <label>景点名称</label>
                  <input v-model="spot.name" type="text" placeholder="景点名称" @blur="saveTrip" />
                </div>
                <div class="form-row">
                  <label>地址</label>
                  <input v-model="spot.address" type="text" placeholder="地址（用于地图定位）" @blur="saveTrip" />
                </div>
                <div class="form-row">
                  <label>备注</label>
                  <textarea v-model="spot.notes" placeholder="记录你的所见所想..." @blur="saveTrip"></textarea>
                </div>

                <!-- 花费记录 -->
                <div class="expense-section">
                  <div class="expense-header">
                    <span>花费记录</span>
                    <button class="btn-small" @click="addExpenseToSpot(day.id, spot.id)">+ 添加花费</button>
                  </div>
                  <div v-for="expense in spot.expenses" :key="expense.id" class="expense-item">
                    <span class="expense-category">{{ expense.category }}</span>
                    <span class="expense-amount">¥{{ expense.amount }}</span>
                    <span class="expense-note">{{ expense.note }}</span>
                    <button class="btn-icon" @click="store.deleteExpense(id, day.id, spot.id, expense.id)">×</button>
                  </div>
                </div>

                <div class="spot-actions">
                  <button class="btn-danger-small" @click="store.deleteSpot(id, day.id, spot.id)">删除景点</button>
                </div>
              </div>
            </div>

            <!-- 景点间交通 -->
            <div v-if="idx < day.spots.length - 1" class="transport-connector">
              <select v-model="spot.transport" class="transport-select" @change="saveTrip">
                <option value="">选择交通方式</option>
                <option value="subway">🚇 地铁</option>
                <option value="bus">🚌 巴士</option>
                <option value="drive">🚗 自驾</option>
                <option value="walk">🚶 步行</option>
                <option value="taxi">🚕 出租车</option>
                <option value="other">其他</option>
              </select>
            </div>
          </template>

          <button class="btn-add-spot" @click="addSpot(day.id)">+ 添加景点</button>
        </div>
      </div>
    </div>

    <!-- 添加花费弹窗 -->
    <div v-if="expenseModal.show" class="modal-overlay" @click.self="expenseModal.show = false">
      <div class="modal">
        <h2>记录花费</h2>
        <div class="form-group">
          <label>金额</label>
          <input v-model="expenseModal.amount" type="number" placeholder="0" min="0" />
        </div>
        <div class="form-group">
          <label>分类</label>
          <select v-model="expenseModal.category">
            <option value="交通">交通</option>
            <option value="餐饮">餐饮</option>
            <option value="门票">门票</option>
            <option value="住宿">住宿</option>
            <option value="购物">购物</option>
            <option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注（可选）</label>
          <input v-model="expenseModal.note" type="text" placeholder="如：午餐" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="expenseModal.show = false">取消</button>
          <button class="btn-primary" @click="confirmExpense">确认</button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="not-found">
    <p>找不到该旅行计划</p>
    <button @click="router.push('/')">返回首页</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripsStore } from '../stores/trips'

const route = useRoute()
const router = useRouter()
const store = useTripsStore()

const id = route.params.id
const trip = computed(() => store.getTrip(id))

const checklistOpen = ref(false)
const newChecklistItem = ref('')
const expandedSpots = ref(new Set())
const expandedDayNotes = ref(new Set()) // 每天的备注是否展开

const expenseModal = ref({
  show: false,
  dayId: null,
  spotId: null,
  amount: '',
  category: '餐饮',
  note: '',
})

function saveTrip() {
  // Trigger localStorage save by calling updateTrip with current data
  store.updateTrip(id, {})
}

function toggleSpot(spotId) {
  if (expandedSpots.value.has(spotId)) {
    expandedSpots.value.delete(spotId)
  } else {
    expandedSpots.value.add(spotId)
  }
}

function addChecklistItem() {
  if (!newChecklistItem.value.trim()) return
  store.addChecklistItem(id, newChecklistItem.value.trim())
  newChecklistItem.value = ''
}

const newDayNote = ref('') // 每个 day 的备注输入

function addDayNote(dayId) {
  if (!newDayNote.value.trim()) return
  store.addDayNote(id, dayId, newDayNote.value.trim())
  newDayNote.value = ''
  expandedDayNotes.value.add(dayId)
}

function toggleDayNotes(dayId) {
  if (expandedDayNotes.value.has(dayId)) {
    expandedDayNotes.value.delete(dayId)
  } else {
    expandedDayNotes.value.add(dayId)
  }
}

function addSpot(dayId) {
  store.addSpot(id, dayId, { name: '', time: '', address: '' })
  // Auto expand the new spot
  const trip = store.getTrip(id)
  const day = trip.days.find(d => d.id === dayId)
  if (day && day.spots.length > 0) {
    const newSpot = day.spots[day.spots.length - 1]
    expandedSpots.value.add(newSpot.id)
  }
}

function addExpenseToSpot(dayId, spotId) {
  expenseModal.value = {
    show: true,
    dayId,
    spotId,
    amount: '',
    category: '餐饮',
    note: '',
  }
}

function confirmExpense() {
  if (!expenseModal.value.amount) return
  store.addExpense(id, expenseModal.value.dayId, expenseModal.value.spotId, {
    amount: expenseModal.value.amount,
    category: expenseModal.value.category,
    note: expenseModal.value.note,
  })
  expenseModal.value.show = false
}
</script>

<style scoped>
.trip-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px 80px;
}

.trip-header {
  position: sticky;
  top: 0;
  background: #fff;
  padding: 16px 0;
  border-bottom: 1px solid #e5e5e5;
  margin-bottom: 24px;
  z-index: 10;
}

.btn-back {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
}

.trip-header h1 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 12px;
}

.header-tabs {
  display: flex;
  gap: 8px;
}

.tab {
  padding: 6px 18px;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  background: none;
  font-size: 14px;
  cursor: pointer;
  color: #666;
}

.tab.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

/* 准备清单 */
.checklist-section {
  margin-bottom: 24px;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  overflow: hidden;
}

.checklist-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 14px 16px;
  background: #f9f9f9;
  border: none;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
}

.checklist-body {
  padding: 12px 16px;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.checklist-item span.done {
  text-decoration: line-through;
  color: #aaa;
}

.checklist-add {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.checklist-add input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

/* 每日行程 */
.day-section {
  margin-bottom: 32px;
}

.day-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.day-title {
  display: flex;
  flex-direction: column;
  min-width: 60px;
}

.day-label {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
}

.day-date {
  font-size: 12px;
  color: #888;
}

.day-theme-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-size: 14px;
  background: #fafafa;
}

.day-theme-input:focus {
  outline: none;
  border-color: #2563eb;
  background: #fff;
}

/* 每日备注 */
.day-notes-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
}

.day-notes-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
}

.notes-toggle {
  font-size: 10px;
  color: #888;
}

.notes-label {
  font-weight: 500;
}

.day-notes-content {
  margin-top: 10px;
  padding-left: 4px;
}

.notes-list {
  list-style: decimal;
  padding-left: 20px;
  margin: 0 0 10px 0;
}

.note-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
}

.note-item input[type="checkbox"] {
  cursor: pointer;
}

.note-done {
  text-decoration: line-through;
  color: #999;
}

.note-item .btn-icon {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0 4px;
  font-size: 14px;
}

.note-item .btn-icon:hover {
  color: #f00;
}

.add-note-input {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.add-note-input input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  font-size: 13px;
}

.add-note-input input:focus {
  outline: none;
  border-color: #2563eb;
}

.add-note-input .btn-small {
  padding: 6px 12px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

/* 景点 */
.spot-card {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 2px;
}

.spot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
}

.spot-header:hover {
  background: #f9f9f9;
}

.spot-basic {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spot-time {
  border: none;
  font-size: 13px;
  color: #888;
  background: transparent;
  cursor: pointer;
}

.spot-name {
  font-size: 15px;
  font-weight: 500;
}

.spot-toggle {
  font-size: 12px;
  color: #aaa;
}

.spot-detail {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
  background: #fafafa;
}

.form-row {
  margin-bottom: 12px;
}

.form-row label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.form-row input,
.form-row textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-row textarea {
  height: 72px;
  resize: vertical;
}

/* 花费 */
.expense-section {
  margin: 12px 0;
}

.expense-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.expense-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 13px;
}

.expense-category {
  background: #eff6ff;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.expense-amount {
  font-weight: 600;
  color: #1a1a1a;
}

.expense-note {
  flex: 1;
  color: #888;
}

/* 交通连接器 */
.transport-connector {
  display: flex;
  align-items: center;
  padding: 6px 16px;
}

.transport-select {
  font-size: 13px;
  padding: 4px 8px;
  border: 1px dashed #ddd;
  border-radius: 6px;
  background: #fafafa;
  color: #666;
  cursor: pointer;
}

.btn-add-spot {
  width: 100%;
  padding: 12px;
  background: none;
  border: 1px dashed #ddd;
  border-radius: 10px;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}

.btn-add-spot:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.spot-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 通用按钮 */
.btn-small {
  padding: 5px 12px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.btn-icon {
  background: none;
  border: none;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.btn-icon:hover {
  color: #ef4444;
}

.btn-danger-small {
  padding: 5px 12px;
  background: none;
  border: 1px solid #fca5a5;
  color: #ef4444;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

/* 弹窗 */
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
  width: 400px;
  max-width: 90vw;
}

.modal h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #555;
  margin-bottom: 6px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: none;
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.not-found {
  text-align: center;
  padding: 80px 0;
}
</style>
