import type { Variants, Transition } from 'motion/react'

export const springFast: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: springFast,
  },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
}

export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
}
