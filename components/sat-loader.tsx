'use client';
import React from 'react';
import './sat-loader.css';

type LoaderVariant = 'brand' | 'exam' | 'results';
type LoaderProps = { variant?: LoaderVariant; label?: string; fullscreen?: boolean; theme?: 'light' | 'dark'; };
const config = {
  brand: { title: 'Tayyorlanmoqda', subtitle: 'O‘quv muhitingiz yuklanmoqda…', icon: 'SAT' },
  exam: { title: 'Imtihon tayyorlanmoqda', subtitle: 'Savollar va imtihon sessiyasi yuklanmoqda…', icon: 'EXAM' },
  results: { title: 'Natijalar hisoblanmoqda', subtitle: 'Javoblaringiz tahlil qilinmoqda…', icon: '✓' }
};
export function SatLoader({ variant='brand',label,fullscreen=true,theme }:LoaderProps) {
  const c = config[variant];
  return <div className={`sat-load sat-load--${variant} ${fullscreen?'sat-load--fullscreen':''} ${theme ? `sat-load--${theme}`:''}`} role="status" aria-live="polite" aria-label={label || c.title}>
    <div className="sat-load__content">
      <div className="sat-load__mark" aria-hidden="true"><span className="sat-load__ring"/><span className="sat-load__logo">{c.icon}</span></div>
      <h2>{label || c.title}</h2><p>{c.subtitle}</p><div className="sat-load__dots" aria-hidden="true"><i/><i/><i/></div>
    </div>
  </div>;
}
export function SatSkeleton({ kind='cards', count=3 }: {kind?: 'cards'|'list'|'exam'|'results';count?:number}){
  return <div className={`sat-skel sat-skel--${kind}`} role="status" aria-label="Ma’lumotlar yuklanmoqda" aria-busy="true">
    {Array.from({length:count},(_,i)=><div className="sat-skel__card" key={i}><div className="sat-skel__icon sat-skel__pulse"/><div className="sat-skel__lines"><div className="sat-skel__line sat-skel__pulse"/><div className="sat-skel__line sat-skel__line--short sat-skel__pulse"/></div></div>)}
  </div>
}
export function InlineSaving({state='saving'}:{state?:'saving'|'saved'|'error'}){
 const labels={saving:'Saqlanmoqda…',saved:'Saqlandi',error:'Saqlashda xatolik'};
 return <span className="sat-saving" role="status">{state==='saving'&&<span className="sat-saving__spinner" aria-hidden="true"/>}{labels[state]}</span>
}
