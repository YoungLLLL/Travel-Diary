<template>
  <div v-if="trip" class="map-view">
    <header class="trip-header">
      <button class="btn-back" @click="router.push({ name: 'trip', params: { id } })">← 返回日程</button>
      <h1>地图视图</h1>
      <div class="header-tabs">
        <button class="tab" @click="router.push({ name: 'trip', params: { id } })">日程</button>
        <button class="tab active">地图</button>
        <button class="tab" @click="router.push({ name: 'trip-bill', params: { id } })">账单</button>
      </div>
    </header>

    <!-- 天数筛选 -->
    <div class="day-filter">
      <button
        :class="['filter-btn', selectedDay === null ? 'active' : '']"
        @click="selectedDay = null"
      >全部</button>
      <button
        v-for="day in trip.days"
        :key="day.id"
        :class="['filter-btn', selectedDay === day.id ? 'active' : '']"
        :style="{ '--day-color': DAY_COLORS[(day.index - 1) % DAY_COLORS.length] }"
        @click="selectedDay = day.id"
      ><span class="day-dot" :style="{ background: DAY_COLORS[(day.index - 1) % DAY_COLORS.length] }"></span>Day {{ day.index }}</button>
    </div>

    <!-- 地图容器 -->
    <div id="map" class="map-container"></div>

    <!-- 景点信息弹窗 -->
    <div v-if="selectedSpot" class="spot-popup">
      <button class="popup-close" @click="selectedSpot = null">×</button>
      <p class="popup-day">Day {{ selectedSpot.dayIndex }} · {{ selectedSpot.dayTheme || selectedSpot.dayDate }}</p>
      <h3>{{ selectedSpot.name }}</h3>
      <p v-if="selectedSpot.time" class="popup-time">{{ selectedSpot.time }}</p>
      <p v-if="selectedSpot.notes" class="popup-notes">{{ selectedSpot.notes }}</p>
    </div>

    <div v-if="!hasSpots" class="empty-map">
      <p>日程中还没有添加带地址的景点</p>
      <p class="hint">请先在日程页面添加景点并填写地址</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripsStore } from '../stores/trips'

const route = useRoute()
const router = useRouter()
const store = useTripsStore()

const id = route.params.id
const trip = computed(() => store.getTrip(id))
const selectedDay = ref(null)
const selectedSpot = ref(null)

let map = null
let markers = []
let polylines = []

// 计算要显示的景点（带地址的）
const visibleSpots = computed(() => {
  if (!trip.value) return []
  const result = []
  const days = selectedDay.value
    ? trip.value.days.filter(d => d.id === selectedDay.value)
    : trip.value.days

  for (const day of days) {
    let spotIndex = 1
    for (const spot of day.spots) {
      if (spot.address && spot.lat && spot.lng) {
        result.push({ ...spot, dayIndex: day.index, dayTheme: day.theme, dayDate: day.date, dayId: day.id, spotOrder: spotIndex })
        spotIndex++
      }
    }
  }
  return result
})

const hasSpots = computed(() => {
  if (!trip.value) return false
  return trip.value.days.some(d => d.spots.some(s => s.address))
})

const TRANSPORT_MODE = {
  subway: 'TRANSIT',
  bus: 'TRANSIT',
  drive: 'DRIVING',
  taxi: 'DRIVING',
  walk: 'WALKING',
  other: 'DRIVING',
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
  map = new window.google.maps.Map(document.getElementById('map'), {
    center: { lat: 35.6762, lng: 139.6503 }, // 默认东京
    zoom: 12,
  })
  renderMapContent()
}

function clearMap() {
  markers.forEach(m => m.setMap(null))
  polylines.forEach(p => p.setMap(null))
  markers = []
  polylines = []
}

async function renderMapContent() {
  if (!map) return
  clearMap()

  const spots = visibleSpots.value
  if (spots.length === 0) return

  const bounds = new window.google.maps.LatLngBounds()
  const days = selectedDay.value
    ? trip.value.days.filter(d => d.id === selectedDay.value)
    : trip.value.days

  // 按天添加标记，每天序号从 1 开始，颜色不同
  for (const day of days) {
    const colorIndex = (day.index - 1) % DAY_COLORS.length
    const color = DAY_COLORS[colorIndex]
    const daySpots = day.spots.filter(s => s.lat && s.lng)

    daySpots.forEach((spot, idx) => {
      const pos = { lat: spot.lat, lng: spot.lng }
      bounds.extend(pos)

      // 用 SVG 生成自定义颜色标记
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="15" r="10" fill="white" opacity="0.3"/>
        <text x="16" y="20" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${idx + 1}</text>
      </svg>`

      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        title: spot.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new window.google.maps.Size(32, 40),
          anchor: new window.google.maps.Point(16, 40),
        },
      })

      marker.addListener('click', () => {
        selectedSpot.value = {
          ...spot,
          dayIndex: day.index,
          dayTheme: day.theme,
          dayDate: day.date,
          dayId: day.id,
        }
      })

      markers.push(marker)
    })
  }

  if (markers.length > 0) map.fitBounds(bounds)

  // 按天绘制路线，颜色与标记一致
  const directionsService = new window.google.maps.DirectionsService()

  for (const day of days) {
    const colorIndex = (day.index - 1) % DAY_COLORS.length
    const color = DAY_COLORS[colorIndex]
    const daySpots = day.spots.filter(s => s.lat && s.lng)

    for (let i = 0; i < daySpots.length - 1; i++) {
      const from = daySpots[i]
      const to = daySpots[i + 1]
      const mode = TRANSPORT_MODE[from.transport] || 'DRIVING'

      try {
        const result = await directionsService.route({
          origin: { lat: from.lat, lng: from.lng },
          destination: { lat: to.lat, lng: to.lng },
          travelMode: window.google.maps.TravelMode[mode],
        })

        const renderer = new window.google.maps.DirectionsRenderer({
          map,
          directions: result,
          suppressMarkers: true,
          polylineOptions: { strokeColor: color, strokeWeight: 3, strokeOpacity: 0.8 },
        })
        polylines.push(renderer)
      } catch (e) {
        const line = new window.google.maps.Polyline({
          path: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }],
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.5,
          strokeWeight: 2,
          map,
        })
        polylines.push(line)
      }
    }
  }
}

// Geocode 地址获取坐标（当 lat/lng 不存在时）
async function geocodeSpots() {
  if (!window.google || !trip.value) return
  const geocoder = new window.google.maps.Geocoder()
  let changed = false

  for (const day of trip.value.days) {
    for (const spot of day.spots) {
      if (spot.address && (!spot.lat || !spot.lng)) {
        try {
          const res = await geocoder.geocode({ address: spot.address })
          if (res.results && res.results.length > 0) {
            const loc = res.results[0].geometry.location
            store.updateSpot(id, day.id, spot.id, { lat: loc.lat(), lng: loc.lng() })
            changed = true
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  if (changed) renderMapContent()
}

function loadGoogleMaps() {
  if (window.google) {
    initMap()
    geocodeSpots()
    return
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
  if (!apiKey) {
    console.warn('Google Maps API Key not set. Add VITE_GOOGLE_MAPS_KEY to .env')
    return
  }

  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
  script.async = true
  script.onload = () => {
    initMap()
    geocodeSpots()
  }
  document.head.appendChild(script)
}

watch(selectedDay, () => {
  if (map) renderMapContent()
})

onMounted(() => {
  loadGoogleMaps()
})

onUnmounted(() => {
  clearMap()
})
</script>

<style scoped>
.map-view {
  max-width: 100%;
  padding: 0 16px;
}

.trip-header {
  position: sticky;
  top: 0;
  background: #fff;
  padding: 16px 0;
  border-bottom: 1px solid #e5e5e5;
  margin-bottom: 12px;
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

.day-filter {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 12px;
}

.filter-btn {
  padding: 5px 14px;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  background: none;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  color: #666;
}

.filter-btn.active {
  background: #eff6ff;
  color: #2563eb;
  border-color: #93c5fd;
}

.day-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}

.map-container {
  width: 100%;
  height: calc(100vh - 200px);
  border-radius: 12px;
  overflow: hidden;
  background: #f0f0f0;
}

.spot-popup {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  min-width: 280px;
  max-width: 90vw;
  z-index: 20;
}

.popup-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 18px;
  color: #aaa;
  cursor: pointer;
}

.popup-day {
  font-size: 12px;
  color: #2563eb;
  margin-bottom: 4px;
}

.spot-popup h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.popup-time {
  font-size: 13px;
  color: #888;
}

.popup-notes {
  font-size: 13px;
  color: #555;
  margin-top: 6px;
}

.empty-map {
  text-align: center;
  padding: 60px 0;
  color: #888;
}

.hint {
  font-size: 13px;
  margin-top: 8px;
}
</style>
