<template>
  <div v-if="trip" class="bill-view">
    <header class="trip-header">
      <button class="btn-back" @click="router.push({ name: 'trip', params: { id } })">← 返回规划</button>
      <h1>旅行账单</h1>
      <div class="header-tabs">
        <button class="tab" @click="router.push({ name: 'trip', params: { id } })">← 返回规划</button>
        <button class="tab active">账单</button>
      </div>
    </header>

    <div class="bill-content">
      <div v-if="bill.total === 0" class="empty-bill">
        <p>还没有花费记录</p>
        <p class="hint">在日程页面的每个景点里添加花费，账单会自动更新</p>
      </div>

      <template v-else>
        <!-- 总花费 -->
        <div class="total-card">
          <span class="total-label">总花费</span>
          <span class="total-amount">¥{{ bill.total.toFixed(2) }}</span>
        </div>

        <!-- 分类汇总 -->
        <div class="section">
          <h2>分类汇总</h2>
          <div class="category-list">
            <div v-for="(amount, category) in bill.categories" :key="category" class="category-item">
              <span class="category-name">{{ category }}</span>
              <div class="category-bar-wrap">
                <div
                  class="category-bar"
                  :style="{ width: (amount / bill.total * 100) + '%' }"
                ></div>
              </div>
              <span class="category-amount">¥{{ amount.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- 按天明细 -->
        <div class="section">
          <h2>按天明细</h2>
          <div v-for="dayData in bill.dayTotals" :key="dayData.day.id" class="day-bill">
            <div v-if="dayData.total > 0" class="day-bill-header">
              <div>
                <span class="day-label">Day {{ dayData.day.index }}</span>
                <span class="day-theme">{{ dayData.day.theme || dayData.day.date }}</span>
              </div>
              <span class="day-total">¥{{ dayData.total.toFixed(2) }}</span>
            </div>
            <div v-if="dayData.expenses.length > 0" class="day-expenses">
              <div v-for="expense in dayData.expenses" :key="expense.id" class="expense-row">
                <span class="expense-spot">{{ expense.spotName }}</span>
                <span class="expense-cat-badge">{{ expense.category }}</span>
                <span v-if="expense.note" class="expense-note">{{ expense.note }}</span>
                <span class="expense-amount">¥{{ Number(expense.amount).toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 导出按钮 -->
      <button class="btn-export" @click="exportCSV">导出表格 (CSV)</button>
    </div>
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
const bill = computed(() => store.getTripBill(id) || { total: 0, categories: {}, dayTotals: [] })

function exportCSV() {
  const rows = [['日期', '主题', '景点', '分类', '备注', '金额']]

  for (const dayData of bill.value.dayTotals) {
    for (const expense of dayData.expenses) {
      rows.push([
        dayData.day.date,
        dayData.day.theme || '',
        expense.spotName,
        expense.category,
        expense.note || '',
        expense.amount,
      ])
    }
  }

  rows.push(['', '', '', '', '总计', bill.value.total.toFixed(2)])

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${trip.value.name}-账单.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.bill-view {
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

.empty-bill {
  text-align: center;
  padding: 60px 0;
  color: #888;
}

.hint {
  font-size: 13px;
  margin-top: 8px;
}

.total-card {
  background: #2563eb;
  color: #fff;
  border-radius: 16px;
  padding: 28px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.total-label {
  font-size: 16px;
  opacity: 0.9;
}

.total-amount {
  font-size: 32px;
  font-weight: 700;
}

.section {
  margin-bottom: 28px;
}

.section h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name {
  width: 48px;
  font-size: 13px;
  color: #555;
}

.category-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.category-bar {
  height: 100%;
  background: #2563eb;
  border-radius: 4px;
  transition: width 0.3s;
}

.category-amount {
  width: 80px;
  text-align: right;
  font-size: 14px;
  font-weight: 500;
}

.day-bill {
  margin-bottom: 16px;
}

.day-bill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 4px;
}

.day-label {
  font-size: 13px;
  font-weight: 700;
  color: #2563eb;
  margin-right: 8px;
}

.day-theme {
  font-size: 14px;
  color: #333;
}

.day-total {
  font-weight: 600;
  font-size: 15px;
}

.day-expenses {
  padding: 0 4px;
}

.expense-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.expense-spot {
  color: #555;
  min-width: 80px;
}

.expense-cat-badge {
  background: #eff6ff;
  color: #2563eb;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.expense-note {
  flex: 1;
  color: #999;
}

.expense-amount {
  font-weight: 600;
  color: #1a1a1a;
  margin-left: auto;
}

.btn-export {
  width: 100%;
  padding: 14px;
  background: none;
  border: 1px solid #2563eb;
  color: #2563eb;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
  font-weight: 500;
  margin-top: 8px;
}

.btn-export:hover {
  background: #eff6ff;
}
</style>
