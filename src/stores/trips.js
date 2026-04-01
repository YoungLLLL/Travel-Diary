import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTripsStore = defineStore('trips', () => {
  const trips = ref(JSON.parse(localStorage.getItem('trips') || '[]'))

  // 兼容旧数据：transport 从字符串迁移为对象
  migrateTransport()
  migrateDayNotes()

  function migrateTransport() {
    let changed = false
    for (const trip of trips.value) {
      for (const day of trip.days) {
        for (const spot of day.spots) {
          if (typeof spot.transport === 'string') {
            spot.transport = { mode: spot.transport, detail: '', cost: null }
            changed = true
          } else if (spot.transport === null || spot.transport === undefined) {
            spot.transport = { mode: null, detail: '', cost: null }
            changed = true
          }
        }
      }
    }
    if (changed) save()
  }

  // 兼容旧数据：添加 day.notes
  function migrateDayNotes() {
    let changed = false
    for (const trip of trips.value) {
      for (const day of trip.days) {
        if (!day.notes) {
          day.notes = []
          changed = true
        }
      }
    }
    if (changed) save()
  }

  function save() {
    localStorage.setItem('trips', JSON.stringify(trips.value))
  }

  function createTrip(name, startDate, endDate) {
    const trip = {
      id: Date.now().toString(),
      name,
      startDate,
      endDate,
      checklist: [],
      days: generateDays(startDate, endDate),
    }
    trips.value.push(trip)
    save()
    return trip.id
  }

  function generateDays(startDate, endDate) {
    const days = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    let current = new Date(start)
    let index = 1

    while (current <= end) {
      days.push({
        id: `day-${index}`,
        index,
        date: current.toISOString().split('T')[0],
        theme: '',
        spots: [],
      })
      current.setDate(current.getDate() + 1)
      index++
    }
    return days
  }

  function deleteTrip(id) {
    trips.value = trips.value.filter(t => t.id !== id)
    save()
  }

  function getTrip(id) {
    return trips.value.find(t => t.id === id)
  }

  function updateTrip(id, updates) {
    const trip = getTrip(id)
    if (trip) {
      Object.assign(trip, updates)
      save()
    }
  }

  // Checklist
  function addChecklistItem(tripId, text) {
    const trip = getTrip(tripId)
    if (trip) {
      trip.checklist.push({ id: Date.now().toString(), text, done: false })
      save()
    }
  }

  function toggleChecklistItem(tripId, itemId) {
    const trip = getTrip(tripId)
    if (trip) {
      const item = trip.checklist.find(i => i.id === itemId)
      if (item) item.done = !item.done
      save()
    }
  }

  function deleteChecklistItem(tripId, itemId) {
    const trip = getTrip(tripId)
    if (trip) {
      trip.checklist = trip.checklist.filter(i => i.id !== itemId)
      save()
    }
  }

  // Spots
  function addSpot(tripId, dayId, spot) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day) {
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
        save()
      }
    }
  }

  function updateSpot(tripId, dayId, spotId, updates) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day) {
        const spot = day.spots.find(s => s.id === spotId)
        if (spot) {
          Object.assign(spot, updates)
          save()
        }
      }
    }
  }

  function deleteSpot(tripId, dayId, spotId) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day) {
        day.spots = day.spots.filter(s => s.id !== spotId)
        save()
      }
    }
  }

  function reorderSpots(tripId, dayId, fromIndex, toIndex) {
    const trip = getTrip(tripId)
    if (!trip) return
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    const spots = day.spots
    const [moved] = spots.splice(fromIndex, 1)
    spots.splice(toIndex, 0, moved)
    save()
  }

  function moveSpot(tripId, fromDayId, fromIndex, toDayId, toIndex) {
    const trip = getTrip(tripId)
    if (!trip) return
    const fromDay = trip.days.find(d => d.id === fromDayId)
    const toDay = trip.days.find(d => d.id === toDayId)
    if (!fromDay || !toDay) return
    const [moved] = fromDay.spots.splice(fromIndex, 1)
    toDay.spots.splice(toIndex, 0, moved)
    save()
  }

  // Expenses
  function addExpense(tripId, dayId, spotId, expense) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day) {
        const spot = day.spots.find(s => s.id === spotId)
        if (spot) {
          spot.expenses.push({
            id: Date.now().toString(),
            amount: expense.amount,
            category: expense.category,
            note: expense.note || '',
          })
          save()
        }
      }
    }
  }

  function deleteExpense(tripId, dayId, spotId, expenseId) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day) {
        const spot = day.spots.find(s => s.id === spotId)
        if (spot) {
          spot.expenses = spot.expenses.filter(e => e.id !== expenseId)
          save()
        }
      }
    }
  }

  // Bill summary — 包含景点花费 + 交通花费
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
        // 景点花费
        for (const expense of spot.expenses) {
          const amount = Number(expense.amount) || 0
          total += amount
          dayTotal += amount
          categories[expense.category] = (categories[expense.category] || 0) + amount
          dayExpenses.push({ spotName: spot.name, ...expense })
        }
        // 交通花费
        const tc = Number(spot.transport?.cost) || 0
        if (tc > 0) {
          total += tc
          dayTotal += tc
          categories['交通'] = (categories['交通'] || 0) + tc
          dayExpenses.push({
            id: `transport-${spot.id}`,
            spotName: spot.transport?.detail || '交通',
            amount: tc,
            category: '交通',
            note: spot.name + ' →',
          })
        }
      }

      dayTotals.push({ day, total: dayTotal, expenses: dayExpenses })
    }

    return { total, categories, dayTotals }
  }

  // Day notes
  function addDayNote(tripId, dayId, text) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day) {
        if (!day.notes) day.notes = []
        day.notes.push({ id: Date.now().toString(), text, done: false })
        save()
      }
    }
  }

  function toggleDayNote(tripId, dayId, noteId) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day && day.notes) {
        const note = day.notes.find(n => n.id === noteId)
        if (note) note.done = !note.done
        save()
      }
    }
  }

  function deleteDayNote(tripId, dayId, noteId) {
    const trip = getTrip(tripId)
    if (trip) {
      const day = trip.days.find(d => d.id === dayId)
      if (day && day.notes) {
        day.notes = day.notes.filter(n => n.id !== noteId)
        save()
      }
    }
  }

  return {
    trips,
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
  }
})
