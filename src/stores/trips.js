import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useTripsStore = defineStore('trips', () => {
  const trips = ref([])
  const syncing = ref(false)

  // =====================
  // 从 Supabase 加载所有行程
  // =====================
  async function fetchTrips() {
    const { data, error } = await supabase
      .from('trips')
      .select('id, data')
      .order('data->startDate', { ascending: true })
    if (error) { console.error('fetchTrips:', error); return }

    const remoteTrips = data.map(row => ({ ...row.data, id: row.id }))

    // 一次性迁移：云端为空 && 本地 localStorage 有数据
    if (remoteTrips.length === 0) {
      const local = JSON.parse(localStorage.getItem('trips') || '[]')
      if (local.length > 0) {
        await importTrips(local)
        localStorage.removeItem('trips')
        return
      }
    }

    trips.value = remoteTrips
    migrateTransport()
    migrateDayNotes()
  }

  // =====================
  // 把单条行程同步到 Supabase
  // =====================
  async function syncTrip(trip) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('trips')
      .upsert({ id: trip.id, user_id: user.id, data: trip, updated_at: new Date().toISOString() })
    if (error) console.error('syncTrip:', error)
  }

  function getTrip(id) {
    return trips.value.find(t => t.id === id)
  }

  // =====================
  // 数据迁移（兼容旧格式）
  // =====================
  function migrateTransport() {
    for (const trip of trips.value) {
      for (const day of trip.days) {
        for (const spot of day.spots) {
          if (typeof spot.transport === 'string') {
            spot.transport = { mode: spot.transport, detail: '', cost: null }
          } else if (!spot.transport) {
            spot.transport = { mode: null, detail: '', cost: null }
          }
        }
      }
    }
  }

  function migrateDayNotes() {
    for (const trip of trips.value) {
      for (const day of trip.days) {
        if (!day.notes) day.notes = []
      }
    }
  }

  // =====================
  // 行程 CRUD
  // =====================
  async function createTrip(name, startDate, endDate) {
    const trip = {
      id: Date.now().toString(),
      name,
      startDate,
      endDate,
      checklist: [],
      days: generateDays(startDate, endDate),
    }
    trips.value.push(trip)
    await syncTrip(trip)
    return trip.id
  }

  async function deleteTrip(id) {
    trips.value = trips.value.filter(t => t.id !== id)
    const { error } = await supabase.from('trips').delete().eq('id', id)
    if (error) console.error('deleteTrip:', error)
  }

  async function updateTrip(id, updates) {
    const trip = getTrip(id)
    if (!trip) return
    Object.assign(trip, updates)
    await syncTrip(trip)
  }

  function generateDays(startDate, endDate) {
    const days = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    let current = new Date(start)
    let index = 1
    while (current <= end) {
      const defaultColors = [
        '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6',
        '#ec4899', '#0891b2', '#854d0e', '#4f46e5', '#059669',
      ]
      days.push({
        id: `day-${index}`,
        index,
        date: current.toISOString().split('T')[0],
        theme: '',
        color: defaultColors[(index - 1) % defaultColors.length],
        spots: [],
        notes: [],
      })
      current.setDate(current.getDate() + 1)
      index++
    }
    return days
  }

  // =====================
  // Checklist
  // =====================
  async function addChecklistItem(tripId, text) {
    const trip = getTrip(tripId)
    if (!trip) return
    trip.checklist.push({ id: Date.now().toString(), text, done: false })
    await syncTrip(trip)
  }

  async function toggleChecklistItem(tripId, itemId) {
    const trip = getTrip(tripId)
    if (!trip) return
    const item = trip.checklist.find(i => i.id === itemId)
    if (item) item.done = !item.done
    await syncTrip(trip)
  }

  async function deleteChecklistItem(tripId, itemId) {
    const trip = getTrip(tripId)
    if (!trip) return
    trip.checklist = trip.checklist.filter(i => i.id !== itemId)
    await syncTrip(trip)
  }

  // =====================
  // Spots
  // =====================
  async function addSpot(tripId, dayId, spot) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    day.spots.push({
      id: Date.now().toString(),
      name: spot.name || '',
      time: spot.time || '',
      address: spot.address || '',
      lat: spot.lat || null,
      lng: spot.lng || null,
      placeId: spot.placeId || null,
      tag: '',
      notes: '',
      photos: [],
      expenses: [],
      transport: { mode: null, detail: '', cost: null },
    })
    await syncTrip(trip)
  }

  async function updateSpot(tripId, dayId, spotId, updates) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    const spot = day.spots.find(s => s.id === spotId)
    if (!spot) return
    Object.assign(spot, updates)
    await syncTrip(trip)
  }

  async function deleteSpot(tripId, dayId, spotId) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    day.spots = day.spots.filter(s => s.id !== spotId)
    await syncTrip(trip)
  }

  async function reorderSpots(tripId, dayId, fromIndex, toIndex) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    const [moved] = day.spots.splice(fromIndex, 1)
    day.spots.splice(toIndex, 0, moved)
    await syncTrip(trip)
  }

  async function moveSpot(tripId, fromDayId, fromIndex, toDayId, toIndex) {
    const trip = getTrip(tripId)
    if (!trip) return
    const fromDay = trip.days.find(d => d.id === fromDayId)
    const toDay = trip.days.find(d => d.id === toDayId)
    if (!fromDay || !toDay) return
    const [moved] = fromDay.spots.splice(fromIndex, 1)
    toDay.spots.splice(toIndex, 0, moved)
    await syncTrip(trip)
  }

  // =====================
  // Expenses
  // =====================
  async function addExpense(tripId, dayId, spotId, expense) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    const spot = day.spots.find(s => s.id === spotId)
    if (!spot) return
    spot.expenses.push({
      id: Date.now().toString(),
      amount: expense.amount,
      category: expense.category,
      note: expense.note || '',
    })
    await syncTrip(trip)
  }

  async function deleteExpense(tripId, dayId, spotId, expenseId) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    const spot = day.spots.find(s => s.id === spotId)
    if (!spot) return
    spot.expenses = spot.expenses.filter(e => e.id !== expenseId)
    await syncTrip(trip)
  }

  // =====================
  // Bill summary
  // =====================
  function getTripBill(tripId) {
    const trip = getTrip(tripId)
    if (!trip) return null
    const categories = {}
    const dayTotals = []
    let total = 0
    for (const day of trip.days) {
      let dayTotal = 0
      const dayExpenses = []
      for (const spot of day.spots) {
        for (const expense of spot.expenses) {
          const amount = Number(expense.amount) || 0
          total += amount; dayTotal += amount
          categories[expense.category] = (categories[expense.category] || 0) + amount
          dayExpenses.push({ spotName: spot.name, ...expense })
        }
        const tc = Number(spot.transport?.cost) || 0
        if (tc > 0) {
          total += tc; dayTotal += tc
          categories['交通'] = (categories['交通'] || 0) + tc
          dayExpenses.push({ id: `transport-${spot.id}`, spotName: spot.transport?.detail || '交通', amount: tc, category: '交通', note: spot.name + ' →' })
        }
      }
      dayTotals.push({ day, total: dayTotal, expenses: dayExpenses })
    }
    return { total, categories, dayTotals }
  }

  // =====================
  // Day notes
  // =====================
  async function addDayNote(tripId, dayId, text) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    if (!day.notes) day.notes = []
    day.notes.push({ id: Date.now().toString(), text, done: false })
    await syncTrip(trip)
  }

  async function toggleDayNote(tripId, dayId, noteId) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day || !day.notes) return
    const note = day.notes.find(n => n.id === noteId)
    if (note) note.done = !note.done
    await syncTrip(trip)
  }

  async function deleteDayNote(tripId, dayId, noteId) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day || !day.notes) return
    day.notes = day.notes.filter(n => n.id !== noteId)
    await syncTrip(trip)
  }

  // =====================
  // 导入（覆盖全部数据）
  // =====================
  async function importTrips(data) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // 先删除云端所有行程
    await supabase.from('trips').delete().eq('user_id', user.id)
    // 再逐条上传
    for (const trip of data) {
      await supabase.from('trips').insert({ id: trip.id, user_id: user.id, data: trip, updated_at: new Date().toISOString() })
    }
    trips.value = data
  }

  return {
    trips,
    syncing,
    fetchTrips,
    createTrip,
    deleteTrip,
    getTrip,
    updateTrip,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    addSpot,
    updateSpot,
    deleteSpot,
    addExpense,
    deleteExpense,
    getTripBill,
    reorderSpots,
    moveSpot,
    addDayNote,
    toggleDayNote,
    deleteDayNote,
    importTrips,
  }
})
