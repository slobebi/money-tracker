import { Tag } from 'antd'
import { useCards } from '../contexts/CardsContext'

export default function Badge({ method }) {
  const { cardMap } = useCards()
  const card = cardMap[method]
  const color = card?.color || '#6b7080'
  const bg    = color + '22'
  return (
    <Tag style={{ background: bg, color, border: 'none', fontWeight: 600 }}>
      {card?.name || method}
    </Tag>
  )
}
