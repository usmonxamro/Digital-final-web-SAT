import type { Metadata } from 'next'
import { DarajaTest } from '@/components/daraja/daraja-test'

export const metadata: Metadata = {
  title: 'Matematik darajangizni aniqlang — o‘zbek yoki ingliz tilida',
  description: "Ingliz tilini bilmasangiz ham matematik darajangizni sinab ko'ring: 44 ta savol, o'zbek va ingliz tilida, SAT shkalasida natija.",
  alternates: { canonical: '/daraja' },
}

export default function DarajaPage() {
  return <DarajaTest />
}
