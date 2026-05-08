import { Tag } from 'antd'
import { CARDS, CARD_BADGE_COLOR } from '../lib/utils'

export default function Badge({ method }) {
  const { bg, color } = CARD_BADGE_COLOR[method] || { bg: '#ffffff11', color: '#aaa' }
  return (
    <Tag style={{ background: bg, color, border: 'none', fontWeight: 600 }}>
      {CARDS[method]}
    </Tag>
  )
}
