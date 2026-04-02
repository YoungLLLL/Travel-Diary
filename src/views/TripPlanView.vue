<template>
  <div v-if="trip" class="plan-layout">

    <!-- ===== LEFT: Map Panel ===== -->
    <div class="map-panel" :class="{ 'add-cursor': addMode }">
      <div id="plan-map" class="map-full"></div>

      <!-- Search bar -->
      <div class="map-search">
        <span class="search-icon">🔍</span>
        <input
          id="map-search-input"
          type="text"
          placeholder="搜索地点，然后点击添加到行程..."
          class="search-input"
        />
      </div>

      <!-- Toolbar -->
      <div class="map-toolbar">
        <button class="btn-map-type" @click="toggleMapType">
          {{ isSatellite ? '🗺️ 地图' : '🛰️ 卫星' }}
        </button>
      </div>

      <!-- New spot dialog -->
      <div v-if="pendingSpot" class="spot-dialog">
        <div class="dialog-header">
          <h3>添加景点</h3>
          <button class="dialog-close" @click="cancelPendingSpot">×</button>
        </div>
        <p class="pending-address">{{ pendingSpot.address || '正在获取地址...' }}</p>
        <div class="dialog-field">
          <label>景点名称</label>
          <input v-model="pendingSpot.name" placeholder="请输入景点名称" ref="nameInputRef" @keyup.enter="confirmAddSpot" />
        </div>
        <div class="dialog-field">
          <label>时间</label>
          <input v-model="pendingSpot.time" type="time" />
        </div>
        <div class="dialog-field">
          <label>添加到</label>
          <select v-model="pendingSpot.dayId">
            <option v-for="day in trip.days" :key="day.id" :value="day.id">
              Day {{ day.index }} · {{ day.date }}
            </option>
          </select>
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="cancelPendingSpot">取消</button>
          <button class="btn-confirm" @click="confirmAddSpot">确认添加</button>
        </div>
      </div>

      <!-- No API key warning -->
      <div v-if="noApiKey" class="no-api-hint">
        <p>地图未配置 Google Maps API Key</p>
        <p class="hint-sub">在项目根目录创建 <code>.env</code> 文件，添加 <code>VITE_GOOGLE_MAPS_KEY=你的Key</code></p>
      </div>
    </div>

    <!-- ===== RIGHT: Itinerary Panel ===== -->
    <div class="itinerary-panel" ref="panelRef">

      <!-- Header -->
      <div class="panel-header">
        <div class="header-top">
          <button class="btn-back" @click="router.push('/')">← 返回</button>
          <button class="btn-bill" @click="router.push({ name: 'trip-bill', params: { id } })">💰 账单</button>
          <button class="btn-bill" @click="router.push({ name: 'trip-export', params: { id } })">🖨️ 打印</button>
        </div>
        <input
          class="trip-title-input"
          :value="trip.name"
          @blur="e => { if (e.target.value.trim()) store.updateTrip(id, { name: e.target.value.trim() }) }"
          @keyup.enter="e => e.target.blur()"
        />
        <p class="trip-meta">{{ trip.startDate }} ~ {{ trip.endDate }} · {{ trip.days.length }} 天</p>
      </div>

      <!-- Checklist -->
      <div class="checklist-section">
        <button class="checklist-toggle" @click="checklistOpen = !checklistOpen">
          <span>准备清单</span>
          <span class="toggle-meta">
            {{ trip.checklist.filter(i => i.done).length }}/{{ trip.checklist.length }}
            {{ checklistOpen ? '▲' : '▼' }}
          </span>
        </button>
        <div v-if="checklistOpen" class="checklist-body">
          <div v-for="item in trip.checklist" :key="item.id" class="checklist-item">
            <input type="checkbox" :checked="item.done" @change="store.toggleChecklistItem(id, item.id)" />
            <span :class="{ done: item.done }">{{ item.text }}</span>
            <button class="btn-icon" @click="store.deleteChecklistItem(id, item.id)">×</button>
          </div>
          <div class="checklist-add">
            <input v-model="newChecklistItem" placeholder="添加清单项..." @keyup.enter="addChecklistItem" />
            <button class="btn-small" @click="addChecklistItem">添加</button>
          </div>
        </div>
      </div>

      <!-- Days -->
      <div v-for="day in trip.days" :key="day.id" :id="`day-block-${day.id}`" class="day-block">

        <!-- Day header -->
        <div class="day-card-header">
          <div class="day-number-block">
            <span class="day-word">Day</span>
            <span class="day-num">{{ day.index }}</span>
          </div>
          <div class="day-info">
            <div class="day-date">{{ formatDate(day.date) }}</div>
            <input
              v-model="day.theme"
              class="day-theme-input"
              placeholder="添加今日主题，如：京都古迹漫步"
              @blur="saveTrip"
            />
          </div>
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

        <!-- Spots timeline -->
        <div class="timeline-body">
          <template v-for="(spot, idx) in day.spots" :key="spot.id">

            <div
              :id="`spot-${spot.id}`"
              :class="[
                'spot-row',
                activeSpotId === spot.id && 'is-active',
                dragState.toDayId === day.id && dragState.overIndex === idx && !(dragState.fromDayId === day.id && dragState.fromIndex === idx) && 'drag-over'
              ]"
              @click="focusSpot(spot, day)"
            >
              <div
                class="drag-handle"
                draggable="true"
                @dragstart="onDragStart($event, day.id, idx)"
                @dragover="onDragOver($event, day.id, idx)"
                @drop="onDrop($event, day.id, idx)"
                @dragend="onDragEnd"
                @click.stop
                title="拖拽调整顺序"
              >⠿</div>
              <div class="timeline-left">
                <div :class="['timeline-dot', getTimePeriodClass(spot.time)]"></div>
                <div v-if="idx < day.spots.length - 1" class="timeline-line"></div>
              </div>

              <div class="spot-content">
                <div v-if="spot.time" class="spot-time-label">
                  {{ getTimePeriodLabel(spot.time) }}
                </div>
                <div class="spot-name-row">
                  <span v-if="activeSpotId !== spot.id" class="spot-name">{{ spot.name || '未命名景点' }}</span>
                  <input
                    v-else
                    class="spot-name-input"
                    :value="spot.name"
                    @blur="e => { if (e.target.value.trim()) { spot.name = e.target.value.trim(); saveTrip() } }"
                    @keyup.enter="e => e.target.blur()"
                    @click.stop
                  />
                  <span v-if="spot.tag && activeSpotId !== spot.id" :class="['spot-tag-badge', `tag-${spot.tag}`]">{{ tagLabel(spot.tag) }}</span>
                  <select
                    v-if="activeSpotId === spot.id"
                    v-model="spot.tag"
                    class="spot-tag-select"
                    :class="spot.tag && `tag-${spot.tag}`"
                    @change="saveTrip"
                    @click.stop
                  >
                    <option value="">标签</option>
                    <option value="sight">🏛 景点</option>
                    <option value="food">🍜 餐饮</option>
                    <option value="hotel">🏨 住宿</option>
                    <option value="shopping">🛍 购物</option>
                    <option value="activity">🎯 活动</option>
                  </select>
                </div>
                <div v-if="spot.notes && activeSpotId !== spot.id" class="spot-notes-preview">{{ spot.notes }}</div>
                <div v-if="spot.expenses.length && activeSpotId !== spot.id" class="spot-expenses-preview">
                  <span v-for="exp in spot.expenses" :key="exp.id" class="exp-preview-item">{{ exp.category }} ¥{{ exp.amount }}<span v-if="exp.note"> · {{ exp.note }}</span></span>
                </div>

                <!-- Expanded edit area -->
                <div v-if="activeSpotId === spot.id" class="spot-expanded" @click.stop>
                  <div class="field-row">
                    <label>时间</label>
                    <input v-model="spot.time" type="time" @change="saveTrip" />
                  </div>

                  <!-- Action buttons -->
                  <div class="spot-action-bar">
                    <button
                      :class="['spot-action-btn', spotPanel[spot.id] === 'expense' && 'is-active']"
                      @click="toggleSpotPanel(spot.id, 'expense')"
                    >
                      <span class="action-icon">💰</span>
                      <span>记账</span>
                      <span v-if="spot.expenses.length" class="action-badge">{{ spot.expenses.length }}</span>
                    </button>
                    <button
                      :class="['spot-action-btn', spotPanel[spot.id] === 'photo' && 'is-active']"
                      @click="toggleSpotPanel(spot.id, 'photo')"
                    >
                      <span class="action-icon">📷</span>
                      <span>拍照</span>
                      <span v-if="spot.photos.length" class="action-badge">{{ spot.photos.length }}</span>
                    </button>
                    <button
                      :class="['spot-action-btn', spotPanel[spot.id] === 'note' && 'is-active']"
                      @click="toggleSpotPanel(spot.id, 'note')"
                    >
                      <span class="action-icon">📝</span>
                      <span>笔记</span>
                      <span v-if="spot.notes" class="action-badge-dot"></span>
                    </button>
                  </div>

                  <!-- Expense panel -->
                  <div v-if="spotPanel[spot.id] === 'expense'" class="spot-panel">
                    <div v-for="exp in spot.expenses" :key="exp.id" class="expense-line">
                      <span class="exp-cat">{{ exp.category }}</span>
                      <span class="exp-note">{{ exp.note }}</span>
                      <span class="exp-amount">¥{{ exp.amount }}</span>
                      <button class="btn-icon" @click.stop="store.deleteExpense(id, day.id, spot.id, exp.id)">×</button>
                    </div>
                    <button class="btn-panel-add" @click="openExpenseModal(day.id, spot.id)">+ 添加花费</button>
                  </div>

                  <!-- Photo panel -->
                  <div v-if="spotPanel[spot.id] === 'photo'" class="spot-panel">
                    <div v-if="spot.photos.length" class="photo-grid">
                      <div v-for="(photo, pIdx) in spot.photos" :key="pIdx" class="photo-thumb">
                        <img :src="photo" />
                        <button class="photo-remove" @click="removePhoto(day.id, spot.id, pIdx)">×</button>
                      </div>
                    </div>
                    <label class="btn-panel-add photo-upload-label">
                      + 添加照片
                      <input type="file" accept="image/*" multiple hidden @change="onPhotoUpload($event, day.id, spot.id)" />
                    </label>
                  </div>

                  <!-- Note panel -->
                  <div v-if="spotPanel[spot.id] === 'note'" class="spot-panel">
                    <textarea v-model="spot.notes" class="note-textarea" placeholder="记录你的所见所想..." @blur="saveTrip"></textarea>
                  </div>

                  <div class="spot-footer-actions">
                    <button class="btn-del-spot" @click.stop="confirmDeleteSpot(day.id, spot.id)">删除景点</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Transport card between spots -->
            <div v-if="idx < day.spots.length - 1" class="transport-card" @click.stop>
              <div class="transport-card-left">
                <div class="transport-dash"></div>
              </div>
              <div class="transport-card-body">
                <div class="transport-row-main">
                  <select
                    v-model="spot.transport.mode"
                    class="transport-select"
                    :class="{ 'has-value': spot.transport.mode }"
                    @change="saveTrip"
                  >
                    <option :value="null">＋ 交通方式</option>
                    <option value="car">🚗 汽车</option>
                    <option value="train">🚆 火车</option>
                    <option value="walk">🚶 步行</option>
                    <option value="subway">🚇 地铁</option>
                    <option value="bus">🚌 公交</option>
                  </select>
                  <span v-if="routeInfo[spot.id] && !routeInfo[spot.id].error" class="route-info">
                    {{ routeInfo[spot.id].distance }} · {{ routeInfo[spot.id].duration }}
                  </span>
                  <span v-if="routeInfo[spot.id]?.transitFailed" class="route-error transit-error">⚠ 暂无公交路线数据</span>
                  <span v-else-if="routeInfo[spot.id]?.error" class="route-error">⚠ 路线获取失败</span>
                </div>
                <div class="transport-row-detail">
                  <input
                    v-model="spot.transport.detail"
                    class="transport-detail-input"
                    placeholder="如：JR山手线 / 新干线のぞみ / 打车..."
                    @blur="saveTrip"
                  />
                  <div class="transport-cost-wrap">
                    <span class="transport-cost-label">¥</span>
                    <input
                      v-model="spot.transport.cost"
                      class="transport-cost-input"
                      type="number"
                      placeholder="费用"
                      min="0"
                      @blur="saveTrip"
                    />
                  </div>
                </div>
              </div>
            </div>

          </template>

          <button
            class="btn-add-spot"
            :class="{ 'drop-target': dragState.fromDayId != null && dragState.toDayId === day.id && dragState.overIndex === day.spots.length }"
            @click="addSpotManual(day.id)"
            @dragover.prevent="onDragOverDay($event, day.id)"
            @drop.prevent="onDropDay($event, day.id)"
          >+ 添加景点</button>
        </div>
      </div>

    </div>

    <!-- ===== Expense Modal ===== -->
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
            <option>交通</option>
            <option>餐饮</option>
            <option>门票</option>
            <option>住宿</option>
            <option>购物</option>
            <option>其他</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注（可选）</label>
          <input v-model="expenseModal.note" placeholder="如：午餐" />
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripsStore } from '../stores/trips'

const route = useRoute()
const router = useRouter()
const store = useTripsStore()

const id = route.params.id
const trip = computed(() => store.getTrip(id))

// Refs
const panelRef = ref(null)
const nameInputRef = ref(null)

// UI state
const checklistOpen = ref(false)
const newChecklistItem = ref('')
const activeSpotId = ref(null)
const addMode = ref(false)
const isSatellite = ref(false)

function toggleMapType() {
  if (!map) return
  isSatellite.value = !isSatellite.value
  map.setMapTypeId(isSatellite.value ? 'hybrid' : 'roadmap')
}
const pendingSpot = ref(null)
const noApiKey = ref(false)
const expandedDayNotes = ref(new Set()) // 每天的备注是否展开
const newDayNote = ref('') // 每天的备注输入

// Spot sub-panels: { [spotId]: 'expense' | 'photo' | 'note' | null }
const spotPanel = ref({})

// Drag state
const dragState = ref({ fromDayId: null, fromIndex: null, toDayId: null, overIndex: null })

// Route info: keyed by "from" spot ID → { distance, duration }
const routeInfo = ref({})

// Cancellation token for drawRoutes
let routeDrawId = 0

// Expense modal
const expenseModal = ref({
  show: false,
  dayId: null,
  spotId: null,
  amount: '',
  category: '餐饮',
  note: '',
})

// Map state
let map = null
let markers = []
let routeRenderers = []
let tempMarker = null

// =====================
// Helpers
// =====================

// 推断当前应添加到哪一天：活跃景点所在天 > 最后一个有景点的天 > 第一天
function getCurrentDayId() {
  if (!trip.value) return ''
  if (activeSpotId.value) {
    for (const day of trip.value.days) {
      if (day.spots.some(s => s.id === activeSpotId.value)) return day.id
    }
  }
  for (let i = trip.value.days.length - 1; i >= 0; i--) {
    if (trip.value.days[i].spots.length > 0) return trip.value.days[i].id
  }
  return trip.value.days[0]?.id || ''
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`
}

function getTimePeriodLabel(time) {
  if (!time) return ''
  const h = parseInt(time.split(':')[0])
  if (h < 12) return '上午'
  if (h < 18) return '下午'
  return '傍晚'
}

function getTimePeriodClass(time) {
  const label = getTimePeriodLabel(time)
  if (label === '上午') return 'morning'
  if (label === '下午') return 'afternoon'
  if (label === '傍晚') return 'evening'
  return 'no-time'
}

function getSpotDayIndex(spotIdx) {
  return spotIdx + 1
}

const TAG_LABELS = { sight: '🏛 景点', food: '🍜 餐饮', hotel: '🏨 住宿', shopping: '🛍 购物', activity: '🎯 活动' }
function tagLabel(tag) {
  return TAG_LABELS[tag] || ''
}

// =====================
// Store actions
// =====================

function saveTrip() {
  store.updateTrip(id, {})
}

function addChecklistItem() {
  if (!newChecklistItem.value.trim()) return
  store.addChecklistItem(id, newChecklistItem.value.trim())
  newChecklistItem.value = ''
}

function addSpotManual(dayId) {
  store.addSpot(id, dayId, { name: '', time: '', address: '' })
  const t = store.getTrip(id)
  const day = t.days.find(d => d.id === dayId)
  if (day && day.spots.length > 0) {
    const newSpot = day.spots[day.spots.length - 1]
    activeSpotId.value = newSpot.id
    nextTick(() => {
      document.getElementById(`spot-${newSpot.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}

function onDragStart(e, dayId, index) {
  dragState.value = { fromDayId: dayId, fromIndex: index, toDayId: dayId, overIndex: index }
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e, dayId, index) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dragState.value.toDayId = dayId
  dragState.value.overIndex = index
}

function onDrop(e, dayId, index) {
  e.preventDefault()
  const { fromDayId, fromIndex } = dragState.value
  if (fromDayId == null || fromIndex == null) return
  if (fromDayId === dayId) {
    if (fromIndex !== index) {
      store.reorderSpots(id, dayId, fromIndex, index)
    }
  } else {
    store.moveSpot(id, fromDayId, fromIndex, dayId, index)
  }
  resetDrag()
}

function onDragOverDay(e, dayId) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const day = trip.value.days.find(d => d.id === dayId)
  dragState.value.toDayId = dayId
  dragState.value.overIndex = day ? day.spots.length : 0
}

function onDropDay(e, dayId) {
  e.preventDefault()
  const { fromDayId, fromIndex } = dragState.value
  if (fromDayId == null || fromIndex == null) return
  const day = trip.value.days.find(d => d.id === dayId)
  const toIndex = day ? day.spots.length : 0
  if (fromDayId === dayId) {
    if (fromIndex !== toIndex && fromIndex !== toIndex - 1) {
      store.reorderSpots(id, dayId, fromIndex, toIndex)
    }
  } else {
    store.moveSpot(id, fromDayId, fromIndex, dayId, toIndex)
  }
  resetDrag()
}

function onDragEnd() {
  resetDrag()
}

function resetDrag() {
  dragState.value = { fromDayId: null, fromIndex: null, toDayId: null, overIndex: null }
}

function confirmDeleteSpot(dayId, spotId) {
  if (confirm('确定删除这个景点？')) {
    store.deleteSpot(id, dayId, spotId)
    if (activeSpotId.value === spotId) activeSpotId.value = null
  }
}

function toggleSpotPanel(spotId, panel) {
  spotPanel.value[spotId] = spotPanel.value[spotId] === panel ? null : panel
}

function toggleDayNotes(dayId) {
  if (expandedDayNotes.value.has(dayId)) {
    expandedDayNotes.value.delete(dayId)
  } else {
    expandedDayNotes.value.add(dayId)
  }
}

function addDayNote(dayId) {
  if (!newDayNote.value.trim()) return
  store.addDayNote(id, dayId, newDayNote.value.trim())
  newDayNote.value = ''
  expandedDayNotes.value.add(dayId)
}

function onPhotoUpload(e, dayId, spotId) {
  const files = e.target.files
  if (!files.length) return
  for (const file of files) {
    const reader = new FileReader()
    reader.onload = () => {
      const t = store.getTrip(id)
      const day = t.days.find(d => d.id === dayId)
      if (!day) return
      const spot = day.spots.find(s => s.id === spotId)
      if (!spot) return
      spot.photos.push(reader.result)
      store.updateTrip(id, {})
    }
    reader.readAsDataURL(file)
  }
  e.target.value = ''
}

function removePhoto(dayId, spotId, photoIndex) {
  const t = store.getTrip(id)
  const day = t.days.find(d => d.id === dayId)
  if (!day) return
  const spot = day.spots.find(s => s.id === spotId)
  if (!spot) return
  spot.photos.splice(photoIndex, 1)
  store.updateTrip(id, {})
}

function openExpenseModal(dayId, spotId) {
  expenseModal.value = { show: true, dayId, spotId, amount: '', category: '餐饮', note: '' }
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

// =====================
// Spot focus / interaction
// =====================

function focusSpot(spot, day) {
  if (activeSpotId.value === spot.id) {
    activeSpotId.value = null
    return
  }
  activeSpotId.value = spot.id

  if (map && spot.lat && spot.lng) {
    map.panTo({ lat: spot.lat, lng: spot.lng })
    map.setZoom(15)
    // Highlight the marker
    renderMarkers()
  }
}

async function saveAndGeocode(dayId, spot) {
  saveTrip()
  if (spot.address && (!spot.lat || !spot.lng) && window.google) {
    const geocoder = new window.google.maps.Geocoder()
    try {
      const res = await geocoder.geocode({ address: spot.address })
      if (res.results && res.results.length > 0) {
        const loc = res.results[0].geometry.location
        const placeId = res.results[0].place_id || null
        store.updateSpot(id, dayId, spot.id, { lat: loc.lat(), lng: loc.lng(), placeId })
      }
    } catch (e) { /* ignore */ }
  }
}

// =====================
// Map
// =====================

const TRANSPORT_MODE = {
  car: 'DRIVING',
  train: 'TRANSIT',
  walk: 'WALKING',
  subway: 'TRANSIT',
  bus: 'TRANSIT',
}

// 每天一个颜色，标记和路线共用
const DAY_COLORS = [
  '#2563eb', // 蓝
  '#dc2626', // 红
  '#16a34a', // 绿
  '#f59e0b', // 橙
  '#8b5cf6', // 紫
  '#ec4899', // 粉
  '#0891b2', // 青
  '#854d0e', // 棕
  '#4f46e5', // 靛蓝
  '#059669', // 翠绿
]

function initMap() {
  if (!window.google) return

  map = new window.google.maps.Map(document.getElementById('plan-map'), {
    center: { lat: 35.6762, lng: 139.6503 },
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  })

  map.addListener('click', (e) => {
    if (e.placeId) {
      e.stop() // 阻止默认的 Google 信息窗口
      handlePoiClick(e.placeId, e.latLng)
      return
    }
    // 只有在标注模式下才查找附近交通站点并处理点击
    if (!addMode.value) return
    tryTransitNearby(e.latLng)
    handleMapClick(e.latLng)
  })

  initSearchBox()
  geocodeExistingSpots().then(() => renderMarkers())
}

function initSearchBox() {
  const input = document.getElementById('map-search-input')
  if (!input) return

  const autocomplete = new window.google.maps.places.Autocomplete(input, {
    fields: ['name', 'geometry', 'formatted_address', 'place_id'],
  })

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace()
    if (!place.geometry?.location) return

    const latLng = place.geometry.location
    map.panTo(latLng)
    map.setZoom(15)

    // Pre-fill the pending spot dialog
    addMode.value = false
    if (tempMarker) tempMarker.setMap(null)
    tempMarker = new window.google.maps.Marker({
      position: latLng,
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    })

    pendingSpot.value = {
      lat: latLng.lat(),
      lng: latLng.lng(),
      address: place.formatted_address || '',
      name: place.name || '',
      placeId: place.place_id || null,
      time: '',
      dayId: getCurrentDayId(),
    }

    // Clear the search input
    input.value = ''

    nextTick(() => nameInputRef.value?.focus())
  })
}

function clearMap() {
  markers.forEach(m => m.setMap(null))
  routeRenderers.forEach(r => r.setMap(null))
  markers = []
  routeRenderers = []
}

function renderMarkers() {
  if (!map || !trip.value) return
  clearMap()

  const bounds = new window.google.maps.LatLngBounds()
  let totalSpots = 0

  for (const day of trip.value.days) {
    const color = DAY_COLORS[(day.index - 1) % DAY_COLORS.length]
    const daySpots = day.spots.filter(s => s.lat && s.lng)

    daySpots.forEach((spot, idx) => {
      totalSpots++
      bounds.extend({ lat: spot.lat, lng: spot.lng })

      const isActive = activeSpotId.value === spot.id
      const activeColor = darkenColor(color)
      const marker = new window.google.maps.Marker({
        position: { lat: spot.lat, lng: spot.lng },
        map,
        title: spot.name,
        label: {
          text: String(idx + 1),
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '12px',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: isActive ? 18 : 14,
          fillColor: isActive ? activeColor : color,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        zIndex: isActive ? 100 : totalSpots,
      })

      marker.addListener('click', () => {
        activeSpotId.value = spot.id
        nextTick(() => {
          document.getElementById(`spot-${spot.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        renderMarkers()
      })

      markers.push(marker)
    })
  }

  if (totalSpots === 0) return

  if (totalSpots > 1) {
    map.fitBounds(bounds, { padding: 60 })
  } else {
    const first = markers[0]?.getPosition()
    if (first) { map.setCenter(first); map.setZoom(14) }
  }

  drawRoutes()
}

// 将颜色加深（用于 active 状态）
function darkenColor(hex) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getTransitDepartureTime() {
  // 始终用明天上午10点，确保：1.是未来时间 2.有班次 3.避开时区陷阱
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

// 用回调包装成 Promise，兼容所有版本的 Google Maps JS API
function requestRoute(directionsService, origin, destination, mode) {
  return new Promise((resolve, reject) => {
    const request = {
      origin,
      destination,
      travelMode: window.google.maps.TravelMode[mode],
    }
    if (mode === 'TRANSIT') {
      request.transitOptions = { departureTime: getTransitDepartureTime() }
    }
    directionsService.route(request, (result, status) => {
      if (status === window.google.maps.DirectionsStatus.OK) {
        resolve(result)
      } else {
        reject(status)
      }
    })
  })
}

// 查找离给定坐标最近的公交/地铁站，返回其 LatLng（500m 范围内）
// 使用新版 Place API（替代已废弃的 PlacesService）
async function findNearestTransitStation(latLng) {
  try {
    const center = (latLng instanceof window.google.maps.LatLng)
      ? latLng
      : new window.google.maps.LatLng(latLng.lat, latLng.lng)
    const { places } = await window.google.maps.places.Place.searchNearby({
      fields: ['location'],
      locationRestriction: { center, radius: 500 },
      includedPrimaryTypes: ['transit_station'],
      maxResultCount: 1,
    })
    return places?.[0]?.location ?? null
  } catch {
    return null
  }
}

// 用路线折线路径手动绘制，替代已废弃的 DirectionsRenderer
function drawRoutePath(path, color) {
  const polyline = new window.google.maps.Polyline({
    path,
    strokeColor: color,
    strokeWeight: 3,
    strokeOpacity: 0.65,
    geodesic: true,
    map,
  })
  routeRenderers.push(polyline)
}

async function drawRoutes() {
  const myId = ++routeDrawId
  if (!map || !trip.value) return
  const directionsService = new window.google.maps.DirectionsService()
  const newRouteInfo = {}

  for (const day of trip.value.days) {
    const dayColor = DAY_COLORS[(day.index - 1) % DAY_COLORS.length]
    const daySpots = day.spots.filter(s => s.lat && s.lng)
    for (let i = 0; i < daySpots.length - 1; i++) {
      // 竞态检查：如果有新的 renderMarkers 调用，停止当前绘制
      if (myId !== routeDrawId) return

      const from = daySpots[i]
      const to = daySpots[i + 1]
      const mode = TRANSPORT_MODE[from.transport?.mode] || 'DRIVING'
      const originLatLng = { lat: from.lat, lng: from.lng }
      const destLatLng = { lat: to.lat, lng: to.lng }

      // 优先使用 placeId（尤其对公交路线准确率大幅提升）
      const originPlace = from.placeId ? { placeId: from.placeId } : originLatLng
      const destPlace = to.placeId ? { placeId: to.placeId } : destLatLng

      let result = null
      let transitFailed = false

      try {
        // 第一次：优先用 placeId 请求（placeId 能精准匹配到公交站点附近）
        result = await requestRoute(directionsService, originPlace, destPlace, mode)
      } catch (e) {
        console.log(`[路线] 第1次尝试失败: ${from.name} → ${to.name} | ${mode} | ${e}`)
        if (mode === 'TRANSIT') {
          // 第二次：用地址字符串重试
          if (from.address && to.address) {
            try {
              result = await requestRoute(directionsService, from.address, to.address, mode)
            } catch (e2) {
              console.log(`[路线] 第2次尝试失败 (地址): ${e2}`)
            }
          }
          if (myId !== routeDrawId) return
          // 第三次：用原始坐标重试（如果前面用的是 placeId）
          if (!result && (from.placeId || to.placeId)) {
            try {
              result = await requestRoute(directionsService, originLatLng, destLatLng, mode)
            } catch (e3) {
              console.log(`[路线] 第3次尝试失败 (坐标): ${e3}`)
            }
          }
          if (myId !== routeDrawId) return
          // 第四次：找最近的公交/地铁站，用车站坐标重试
          if (!result) {
            try {
              const [nearOrigin, nearDest] = await Promise.all([
                findNearestTransitStation(originLatLng),
                findNearestTransitStation(destLatLng),
              ])
              if (nearOrigin || nearDest) {
                result = await requestRoute(
                  directionsService,
                  nearOrigin || originLatLng,
                  nearDest || destLatLng,
                  mode,
                )
              }
            } catch (e4) {
              console.log(`[路线] 第4次尝试失败 (附近站点): ${e4}`)
            }
          }
          if (!result) {
            console.warn(`[公交路线失败] ${from.name} → ${to.name} | 所有尝试均无结果`)
            transitFailed = true
          }
        } else {
          console.warn(`[路线失败] ${from.name} → ${to.name} | 模式: ${mode} | ${e}`)
        }
      }

      if (myId !== routeDrawId) return

      if (result) {
        const leg = result.routes[0]?.legs[0]
        newRouteInfo[from.id] = {
          distance: leg?.distance?.text || '',
          duration: leg?.duration?.text || '',
        }
        const path = result.routes[0]?.overview_path || []
        drawRoutePath(path, dayColor)
      } else {
        newRouteInfo[from.id] = { error: true, transitFailed }
        const line = new window.google.maps.Polyline({
          path: [originLatLng, destLatLng],
          geodesic: true,
          strokeColor: transitFailed ? '#f97316' : '#94a3b8',
          strokeOpacity: 0.5,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
            offset: '0',
            repeat: '12px',
          }],
          map,
        })
        routeRenderers.push(line)
      }
    }
  }

  if (myId !== routeDrawId) return
  routeInfo.value = newRouteInfo
}

async function tryTransitNearby(latLng) {
  try {
    const { places } = await window.google.maps.places.Place.searchNearby({
      fields: ['displayName', 'location', 'formattedAddress'],
      locationRestriction: { center: latLng, radius: 80 },
      includedPrimaryTypes: ['transit_station'],
      maxResultCount: 1,
    })
    if (!places?.length) return
    const station = places[0]
    const loc = station.location
    if (tempMarker) tempMarker.setMap(null)
    tempMarker = new window.google.maps.Marker({
      position: loc,
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    })
    addMode.value = false
    pendingSpot.value = {
      lat: loc.lat(),
      lng: loc.lng(),
      address: station.formattedAddress || '',
      name: station.displayName || '',
      placeId: station.id || null,
      time: '',
      dayId: getCurrentDayId(),
    }
    nextTick(() => nameInputRef.value?.focus())
  } catch { /* 附近没有公交站，忽略 */ }
}

async function handlePoiClick(placeId, latLng) {
  try {
    // 使用 Place Details API 获取地点信息
    const service = new window.google.maps.places.PlacesService(map)
    service.getDetails({ placeId }, (place, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
        // 如果获取失败，使用 geocoding 作为后备
        fallbackGeocode(latLng)
        return
      }

      const loc = place.geometry?.location || latLng

      if (tempMarker) tempMarker.setMap(null)
      tempMarker = new window.google.maps.Marker({
        position: loc,
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      })

      addMode.value = false
      pendingSpot.value = {
        lat: loc.lat(),
        lng: loc.lng(),
        address: place.formatted_address || '',
        name: place.name || '',
        placeId: placeId,
        time: '',
        dayId: getCurrentDayId(),
      }

      nextTick(() => nameInputRef.value?.focus())
    })
  } catch { /* 获取地点详情失败，尝试 geocoding */
    fallbackGeocode(latLng)
  }
}

async function fallbackGeocode(latLng) {
  try {
    const geocoder = new window.google.maps.Geocoder()
    const res = await geocoder.geocode({ location: latLng })
    const result = res.results[0]
    const loc = latLng

    if (tempMarker) tempMarker.setMap(null)
    tempMarker = new window.google.maps.Marker({
      position: loc,
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    })

    addMode.value = false
    pendingSpot.value = {
      lat: loc.lat(),
      lng: loc.lng(),
      address: result?.formatted_address || '',
      name: '',
      placeId: null,
      time: '',
      dayId: getCurrentDayId(),
    }

    nextTick(() => nameInputRef.value?.focus())
  } catch { /* geocoding 也失败，忽略 */ }
}

function toggleAddMode() {
  addMode.value = !addMode.value
  if (!addMode.value && tempMarker) {
    tempMarker.setMap(null)
    tempMarker = null
  }
}

async function handleMapClick(latLng) {
  if (tempMarker) tempMarker.setMap(null)
  tempMarker = new window.google.maps.Marker({
    position: latLng,
    map,
    icon: {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#10b981',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
    },
  })

  let address = ''
  try {
    const geocoder = new window.google.maps.Geocoder()
    const res = await geocoder.geocode({ location: latLng })
    address = res.results[0]?.formatted_address || ''
  } catch (e) { /* ignore */ }

  addMode.value = false
  pendingSpot.value = {
    lat: latLng.lat(),
    lng: latLng.lng(),
    address,
    name: '',
    time: '',
    dayId: getCurrentDayId(),
  }

  await nextTick()
  nameInputRef.value?.focus()
}

function cancelPendingSpot() {
  pendingSpot.value = null
  if (tempMarker) {
    tempMarker.setMap(null)
    tempMarker = null
  }
}

function confirmAddSpot() {
  if (!pendingSpot.value) return
  const { name, time, address, lat, lng, placeId, dayId } = pendingSpot.value

  store.addSpot(id, dayId, { name: name || '新景点', time, address, lat, lng, placeId: placeId || null })

  if (tempMarker) {
    tempMarker.setMap(null)
    tempMarker = null
  }
  pendingSpot.value = null

  // Focus the newly added spot
  const t = store.getTrip(id)
  const day = t.days.find(d => d.id === dayId)
  if (day && day.spots.length > 0) {
    const newSpot = day.spots[day.spots.length - 1]
    activeSpotId.value = newSpot.id
    nextTick(() => {
      document.getElementById(`spot-${newSpot.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}

async function geocodeExistingSpots() {
  if (!window.google || !trip.value) return
  const geocoder = new window.google.maps.Geocoder()

  for (const day of trip.value.days) {
    for (const spot of day.spots) {
      if (spot.address && (!spot.lat || !spot.lng)) {
        try {
          const res = await geocoder.geocode({ address: spot.address })
          if (res.results && res.results.length > 0) {
            const loc = res.results[0].geometry.location
            const placeId = res.results[0].place_id || null
            store.updateSpot(id, day.id, spot.id, { lat: loc.lat(), lng: loc.lng(), placeId })
          }
        } catch (e) { /* ignore */ }
      }
    }
  }
}

function loadGoogleMaps() {
  if (window.google) {
    initMap()
    return
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
  if (!apiKey) {
    noApiKey.value = true
    return
  }

  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  script.async = true
  script.onload = () => initMap()
  document.head.appendChild(script)
}

// Only re-render markers when lat/lng or transport changes (not on every keystroke)
const mapSpots = computed(() => {
  if (!trip.value) return []
  const result = []
  for (const day of trip.value.days) {
    for (const spot of day.spots) {
      result.push({ id: spot.id, lat: spot.lat, lng: spot.lng, placeId: spot.placeId, transportMode: spot.transport?.mode, name: spot.name })
    }
  }
  return result
})

watch(mapSpots, () => {
  if (map) renderMarkers()
}, { deep: true })

onMounted(() => {
  loadGoogleMaps()
})

onUnmounted(() => {
  clearMap()
  if (tempMarker) tempMarker.setMap(null)
})
</script>

<style scoped>
/* ===== Layout ===== */
.plan-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* ===== Map Panel ===== */
.map-panel {
  flex: 0 0 55%;
  position: relative;
  background: #e8e8e8;
}

.map-panel.add-cursor {
  cursor: crosshair;
}

.map-full {
  width: 100%;
  height: 100%;
}

.map-toolbar {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.btn-add-on-map {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
  transition: background 0.2s;
}

.btn-add-on-map:hover {
  background: #1d4ed8;
}

.btn-add-on-map.is-active {
  background: #64748b;
}

.btn-map-type {
  background: #fff;
  color: #374151;
  border: none;
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: background 0.2s;
}

.btn-map-type:hover {
  background: #f3f4f6;
}

.map-search {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 480px;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  padding: 0 14px;
  z-index: 10;
}

.search-icon {
  font-size: 15px;
  margin-right: 8px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  padding: 12px 0;
  background: transparent;
  color: #1a1a1a;
}

.search-input::placeholder {
  color: #aaa;
}

.add-mode-hint {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 8px 20px;
  border-radius: 20px;
  font-size: 14px;
  z-index: 10;
  pointer-events: none;
}

/* Spot dialog (on map panel) */
.spot-dialog {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  z-index: 20;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dialog-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.dialog-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #aaa;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.pending-address {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
  line-height: 1.4;
}

.dialog-field {
  margin-bottom: 10px;
}

.dialog-field label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.dialog-field input,
.dialog-field select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.dialog-field input:focus,
.dialog-field select:focus {
  outline: none;
  border-color: #2563eb;
}

.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.btn-cancel {
  flex: 1;
  padding: 8px;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: #555;
}

.btn-confirm {
  flex: 2;
  padding: 8px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-confirm:hover {
  background: #1d4ed8;
}

.no-api-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #666;
}

.hint-sub {
  font-size: 13px;
  color: #888;
  margin-top: 8px;
}

.hint-sub code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* ===== Itinerary Panel ===== */
.itinerary-panel {
  flex: 0 0 45%;
  height: 100vh;
  overflow-y: auto;
  background: #f5f6f8;
}

/* Header */
.panel-header {
  position: sticky;
  top: 0;
  background: #fff;
  padding: 16px 20px 14px;
  border-bottom: 1px solid #e8e8e8;
  z-index: 10;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.btn-back {
  background: none;
  border: none;
  color: #2563eb;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
}

.btn-bill {
  background: #f0f4ff;
  border: none;
  color: #2563eb;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 500;
}

.btn-bill:hover {
  background: #dbeafe;
}

.trip-title-input {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 2px;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
}
.trip-title-input:hover {
  background: #f5f5f5;
  border-radius: 4px;
}
.trip-title-input:focus {
  background: #f0f4ff;
  border-radius: 4px;
}

.trip-meta {
  font-size: 13px;
  color: #888;
  margin: 0;
}

/* Checklist */
.checklist-section {
  background: #fff;
  margin: 12px 16px 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e8e8e8;
}

.checklist-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.toggle-meta {
  font-size: 13px;
  color: #999;
  font-weight: 400;
}

.checklist-body {
  padding: 8px 16px 14px;
  border-top: 1px solid #f0f0f0;
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 14px;
}

.checklist-item span.done {
  text-decoration: line-through;
  color: #bbb;
}

.checklist-add {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.checklist-add input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

/* Day block */
.day-block {
  margin: 12px 16px 0;
}

.day-card-header {
  background: #fff;
  border-radius: 12px 12px 0 0;
  padding: 16px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  border-bottom: 1px solid #f0f0f0;
}

.day-number-block {
  min-width: 52px;
  height: 52px;
  background: #2563eb;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.day-word {
  font-size: 10px;
  font-weight: 500;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.day-num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.day-info {
  flex: 1;
  padding-top: 2px;
}

.day-date {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}

.day-theme-input {
  width: 100%;
  border: none;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  padding: 0;
  background: transparent;
  outline: none;
  box-sizing: border-box;
}

.day-theme-input::placeholder {
  color: #bbb;
  font-weight: 400;
}

/* 每日备注 */
.day-notes-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 10px 14px;
  margin: 10px 16px;
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

/* Timeline */
.timeline-body {
  background: #fff;
  border-radius: 0 0 12px 12px;
  padding: 6px 12px 10px;
  margin-bottom: 4px;
  border: 1px solid #eee;
  border-top: none;
}

.spot-row {
  display: flex;
  gap: 8px;
  cursor: pointer;
  border-radius: 6px;
  padding: 4px 6px;
  transition: background 0.15s;
}

.spot-row:hover {
  background: #f9fafb;
}

.spot-row:hover .drag-handle {
  opacity: 1;
}

.spot-row.drag-over {
  border-top: 2px solid #2563eb;
  margin-top: -2px;
}

.drag-handle {
  opacity: 0;
  cursor: grab;
  color: #ccc;
  font-size: 14px;
  padding: 2px 2px 2px 0;
  flex-shrink: 0;
  transition: opacity 0.15s;
  user-select: none;
  align-self: flex-start;
  padding-top: 2px;
}

.drag-handle:active {
  cursor: grabbing;
}

.spot-row.is-active {
  background: #f8fafc;
  border-left: 2px solid #2563eb;
  padding-left: 4px;
}

/* Timeline left column */
.timeline-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 3px;
  width: 12px;
  flex-shrink: 0;
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid #fff;
  box-shadow: 0 0 0 1px #d1d5db;
}

.timeline-dot.morning { background: #38bdf8; box-shadow: 0 0 0 1px #38bdf8; }
.timeline-dot.afternoon { background: #2563eb; box-shadow: 0 0 0 1px #2563eb; }
.timeline-dot.evening { background: #7c3aed; box-shadow: 0 0 0 1px #7c3aed; }
.timeline-dot.no-time { background: #d1d5db; box-shadow: 0 0 0 1px #d1d5db; }

.timeline-line {
  flex: 1;
  width: 1.5px;
  background: #e5e7eb;
  margin: 3px 0;
  min-height: 12px;
}

/* Spot content */
.spot-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 2px;
}

.spot-time-label {
  font-size: 12px;
  color: #9ca3af;
  line-height: 1;
  margin-bottom: 2px;
}

.spot-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spot-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-name-input {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: #f0f4ff;
  border-radius: 4px;
  padding: 1px 4px;
  font-family: inherit;
}

/* Spot tag */
.spot-tag-select {
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  padding: 2px 20px 2px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 11px;
  color: #64748b;
  background: #f8fafc;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%2394a3b8'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}

.spot-tag-select:hover { border-color: #93c5fd; }

.spot-tag-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.tag-sight { background: #fef3c7; color: #92400e; }
.tag-food { background: #ffe4e6; color: #9f1239; }
.tag-hotel { background: #e0e7ff; color: #3730a3; }
.tag-shopping { background: #d1fae5; color: #065f46; }
.tag-activity { background: #f3e8ff; color: #6b21a8; }

.spot-tag-select.tag-sight { background-color: #fef3c7; color: #92400e; border-color: #fcd34d; }
.spot-tag-select.tag-food { background-color: #ffe4e6; color: #9f1239; border-color: #fda4af; }
.spot-tag-select.tag-hotel { background-color: #e0e7ff; color: #3730a3; border-color: #a5b4fc; }
.spot-tag-select.tag-shopping { background-color: #d1fae5; color: #065f46; border-color: #6ee7b7; }
.spot-tag-select.tag-activity { background-color: #f3e8ff; color: #6b21a8; border-color: #c4b5fd; }

.spot-notes-preview {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.spot-expenses-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 2px;
}

.exp-preview-item {
  font-size: 12px;
  color: #6b7280;
}

/* Expanded edit */
.spot-expanded {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #f0f0f0;
}

.field-row {
  margin-bottom: 8px;
}

.field-row label {
  display: block;
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.field-row input,
.field-row select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  background: #fff;
}

.field-row input:focus,
.field-row select:focus {
  outline: none;
  border-color: #2563eb;
}

/* Action button bar */
.spot-action-bar {
  display: flex;
  gap: 6px;
  margin: 8px 0 4px;
}

.spot-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.spot-action-btn:hover {
  background: #f0f4ff;
  border-color: #93c5fd;
  color: #2563eb;
}

.spot-action-btn.is-active {
  background: #eff6ff;
  border-color: #60a5fa;
  color: #2563eb;
}

.action-icon {
  font-size: 13px;
}

.action-badge {
  background: #2563eb;
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.action-badge-dot {
  width: 6px;
  height: 6px;
  background: #2563eb;
  border-radius: 50%;
}

/* Sub-panels */
.spot-panel {
  margin-top: 6px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.btn-panel-add {
  width: 100%;
  padding: 7px;
  background: none;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 12px;
  cursor: pointer;
  margin-top: 4px;
  transition: all 0.15s;
}

.btn-panel-add:hover {
  border-color: #2563eb;
  color: #2563eb;
}

/* Expense items */
.expense-line {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: #fff;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 13px;
}

.exp-cat {
  background: #eff6ff;
  color: #2563eb;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  flex-shrink: 0;
}

.exp-note {
  flex: 1;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exp-amount {
  font-weight: 600;
  flex-shrink: 0;
}

/* Photo grid */
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.photo-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.photo-thumb:hover .photo-remove {
  opacity: 1;
}

.photo-upload-label {
  display: block;
  text-align: center;
  cursor: pointer;
}

/* Note textarea */
.note-textarea {
  width: 100%;
  height: 72px;
  padding: 8px 10px;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  background: #fff;
  resize: vertical;
  font-family: inherit;
}

.note-textarea:focus {
  outline: none;
  border-color: #2563eb;
}

/* Footer */
.spot-footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.btn-del-spot {
  background: none;
  border: 1px solid #fca5a5;
  color: #ef4444;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.btn-del-spot:hover {
  background: #fef2f2;
}

/* Transport card */
.transport-card {
  display: flex;
  gap: 8px;
  padding: 0 6px 0 26px;
  margin: 0;
}

.transport-card-left {
  display: flex;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
  justify-content: center;
}

.transport-dash {
  width: 1.5px;
  height: 100%;
  min-height: 18px;
  background: repeating-linear-gradient(
    to bottom,
    #d1d5db 0px,
    #d1d5db 3px,
    transparent 3px,
    transparent 6px
  );
}

.transport-card-body {
  flex: 1;
  background: transparent;
  border: none;
  border-left: 2px solid #e2e8f0;
  border-radius: 0;
  padding: 4px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transport-row-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.transport-select {
  appearance: none;
  -webkit-appearance: none;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 24px 4px 10px;
  font-size: 13px;
  color: #94a3b8;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: all 0.15s;
}

.transport-select.has-value {
  background-color: #eff6ff;
  border-color: #93c5fd;
  color: #2563eb;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%232563eb'/%3E%3C/svg%3E");
}

.transport-select:hover {
  border-color: #60a5fa;
}

.route-info {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
}

.transit-error {
  color: #f97316;
}

.route-error {
  font-size: 11px;
  color: #f59e0b;
}

.transport-row-detail {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transport-detail-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #334155;
  padding: 2px 0;
  outline: none;
  min-width: 0;
}

.transport-detail-input::placeholder {
  color: #c1c9d4;
  font-size: 12px;
}

.transport-cost-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 2px 8px;
}

.transport-cost-label {
  font-size: 12px;
  color: #94a3b8;
}

.transport-cost-input {
  width: 56px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #334155;
  padding: 2px 0;
  outline: none;
  text-align: right;
}

.transport-cost-input::placeholder {
  color: #c1c9d4;
  font-size: 12px;
}

/* Hide number input spinners */
.transport-cost-input::-webkit-inner-spin-button,
.transport-cost-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Add spot button */
.btn-add-spot {
  width: 100%;
  padding: 10px;
  background: none;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  color: #9ca3af;
  font-size: 13px;
  cursor: pointer;
  margin-top: 8px;
  transition: all 0.15s;
}

.btn-add-spot:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: #f0f4ff;
}

.btn-add-spot.drop-target {
  border-color: #2563eb;
  border-style: solid;
  background: #eff6ff;
  color: #2563eb;
}

/* Common buttons */
.btn-icon {
  background: none;
  border: none;
  color: #ccc;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  flex-shrink: 0;
}

.btn-icon:hover { color: #ef4444; }

.btn-small {
  padding: 7px 14px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-tiny {
  padding: 3px 10px;
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: #555;
}

.btn-tiny:hover {
  border-color: #2563eb;
  color: #2563eb;
}

/* ===== Expense Modal ===== */
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
  padding: 28px;
  width: 380px;
  max-width: 90vw;
}

.modal h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 18px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #555;
  margin-bottom: 5px;
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
  gap: 10px;
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
  font-weight: 500;
}

.btn-primary:hover { background: #1d4ed8; }

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: none;
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* Not found */
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #888;
  gap: 16px;
}
</style>
