<template>
  <div class="export-page">

    <!-- 工具栏（打印时隐藏） -->
    <div class="export-toolbar no-print">
      <button class="btn-back" @click="router.back()">← 返回</button>
      <button class="btn-download" @click="printPDF">下载 PDF</button>
    </div>

    <!-- 可打印内容 -->
    <div v-if="trip" class="export-doc">

      <h1 class="doc-title">{{ trip.name }}</h1>
      <p class="doc-dates">{{ trip.startDate }} — {{ trip.endDate }}</p>

      <!-- 准备清单 -->
      <template v-if="trip.checklist && trip.checklist.length">
        <h2 class="section-title">出发前准备</h2>
        <table>
          <thead>
            <tr><th style="width:44px">状态</th><th>事项</th></tr>
          </thead>
          <tbody>
            <tr v-for="item in trip.checklist" :key="item.id">
              <td class="td-check">□</td>
              <td>{{ item.text }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- 每日行程 -->
      <template v-for="day in trip.days" :key="day.id">
        <template v-if="day.spots.length">
          <h2 class="section-title">
            Day {{ day.index }} · {{ formatDate(day.date) }}<template v-if="day.theme"> · {{ day.theme }}</template>
          </h2>
          <table>
            <thead>
              <tr :style="{ background: getDayColor(day), color: '#fff' }">
                <th style="width:48px"></th>
                <th style="width:60px">时间</th>
                <th>地点</th>
                <th>交通（前往本站）</th>
                <th style="width:72px">费用</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in getDayRows(day)" :key="row.spot.id">
                <tr>
                  <td v-if="row.showPeriod" class="td-period" :rowspan="row.periodRowspan">
                    {{ row.period }}
                  </td>
                  <td class="td-time">{{ row.spot.time }}</td>
                  <td>{{ row.spot.name }}</td>
                  <td class="td-transport">{{ row.prevTransportLabel }}</td>
                  <td class="td-cost">{{ formatCost(row.spot) }}</td>
                  <td class="td-note">{{ row.spot.notes }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </template>
      </template>

    </div>

    <div v-else class="not-found no-print">找不到该行程</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripsStore } from '../stores/trips'

const route = useRoute()
const router = useRouter()
const store = useTripsStore()

const id = route.params.id
const trip = computed(() => store.getTrip(id))

const TRANSPORT_LABELS = {
  walk:   '步行',
  subway: '地铁',
  bus:    '巴士',
  train:  '电车',
  car:    '自驾',
  taxi:   '出租车',
  drive:  '自驾',
  other:  '其他',
}

function getPeriod(time) {
  if (!time) return '上午'
  const h = parseInt(time.split(':')[0], 10)
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 18) return '下午'
  return '晚上'
}

function formatTransportLabel(transport) {
  if (!transport?.mode) return ''
  const label = TRANSPORT_LABELS[transport.mode] || transport.mode
  const detail = transport.detail ? ` · ${transport.detail}` : ''
  return label + detail
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}/${day} ${weekdays[d.getDay()]}`
}

function formatCost(spot) {
  let total = 0
  for (const e of spot.expenses || []) {
    total += Number(e.amount) || 0
  }
  if (spot.transport?.cost) total += Number(spot.transport.cost) || 0
  return total > 0 ? `¥${total.toLocaleString()}` : ''
}

function getDayRows(day) {
  const spots = day.spots
  const rows = []

  for (let i = 0; i < spots.length; i++) {
    rows.push({
      spot: spots[i],
      period: getPeriod(spots[i].time),
      prevTransportLabel: i > 0 ? formatTransportLabel(spots[i - 1].transport) : '',
      showPeriod: false,
      periodRowspan: 0,
    })
  }

  // 计算 rowspan：将相邻同一时间段的行合并
  let i = 0
  while (i < rows.length) {
    const p = rows[i].period
    let j = i
    while (j < rows.length && rows[j].period === p) j++
    rows[i].showPeriod = true
    rows[i].periodRowspan = j - i
    i = j
  }

  return rows
}

const DAY_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6',
  '#ec4899', '#0891b2', '#854d0e', '#4f46e5', '#059669',
]

function getDayColor(day) {
  return day.color || DAY_COLORS[(day.index - 1) % DAY_COLORS.length]
}

function printPDF() {
  window.print()
}
</script>

<style scoped>
/* ===== 页面布局 ===== */
.export-page {
  min-height: 100vh;
  background: #f0f0f0;
}

/* ===== 工具栏 ===== */
.export-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 40px;
  background: #fff;
  border-bottom: 1px solid #ddd;
  position: sticky;
  top: 0;
  z-index: 10;
}

.btn-back {
  background: none;
  border: 1px solid #ccc;
  padding: 6px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-download {
  background: #111;
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.btn-back:hover { background: #f5f5f5; }
.btn-download:hover { background: #333; }

/* ===== 文档主体 ===== */
.export-doc {
  max-width: 860px;
  margin: 32px auto;
  background: #fff;
  padding: 48px 52px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.doc-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
}

.doc-dates {
  font-size: 11px;
  color: #555;
  margin: 0 0 36px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  margin: 32px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #111;
}

/* ===== 表格 ===== */
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4px;
  font-size: 11px;
}

th, td {
  border: 1px solid #ccc;
  padding: 5px 8px;
  text-align: left;
  vertical-align: middle;
}

th {
  font-weight: 700;
  font-size: 10px;
}

.td-period {
  font-weight: 600;
  font-size: 11px;
  text-align: center;
  background: #fafafa;
  width: 48px;
}

.td-time     { color: #333; white-space: nowrap; }
.td-transport { color: #555; }
.td-cost     { white-space: nowrap; }
.td-note     { color: #555; }
.td-check    { text-align: center; }

.not-found {
  text-align: center;
  padding: 80px;
  color: #999;
}

/* ===== 打印样式 ===== */
@media print {
  .no-print { display: none !important; }

  .export-page {
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .export-doc {
    margin: 0;
    padding: 0;
    box-shadow: none;
    max-width: 100%;
  }

  th, td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  table { page-break-inside: avoid; }

  h2.section-title { page-break-after: avoid; }
}
</style>
