import { createContext, useContext, useState, useEffect } from 'react'
import { fetchCards } from '../lib/supabase'

const CardsContext = createContext(null)

export function CardsProvider({ children }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const data = await fetchCards()
      setCards(data)
    } catch (e) {
      console.error('Failed to load cards:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  const creditCards = cards.filter(c => c.type === 'credit')
  const debitCards  = cards.filter(c => c.type === 'debit')
  const cardMap     = Object.fromEntries(cards.map(c => [c.id, c]))

  return (
    <CardsContext.Provider value={{ cards, creditCards, debitCards, cardMap, loading, refresh, setCards }}>
      {children}
    </CardsContext.Provider>
  )
}

export function useCards() {
  return useContext(CardsContext)
}
