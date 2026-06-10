'use client'

import { motion } from 'motion/react'
import { springFast } from '@/lib/motion-variants'

export function AnimatedStatsGrid({ children }: { children: React.ReactElement | React.ReactElement[] }) {
  const items = Array.isArray(children) ? children : [children]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springFast, delay: i * 0.08 }}
          whileHover={{ y: -2, transition: springFast }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}
