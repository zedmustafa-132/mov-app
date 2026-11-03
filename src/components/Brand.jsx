import { useId } from 'react'

export function BrandMark({ className = '' }) {
  return <svg className={`brand-mark ${className}`} viewBox="0 0 64 64" aria-hidden="true">
    <path fill="currentColor" d="M22 3h20l19 19v20L42 61H22L3 42V22Z" />
    <path fill="#20120c" d="M14 44V20h10l8 11 8-11h10v24H40V34l-8 10-8-10v10Z" />
    <path fill="#fff" opacity=".3" d="M22 3h20l7 7H19l-9 9v-4Z" />
  </svg>
}

export function Brand({ className = '' }) {
  return <span className={`mov-brand ${className}`} aria-label="MOV"><BrandMark /><span>MOV<span className="brand-period">.</span></span></span>
}

// Spark is MOV's vector character: the same silhouette at avatar and welcome sizes.
export function Spark({ faceOnly = false, className = '' }) {
  const id = useId()
  return <svg className={`spark-character ${className}`} viewBox={faceOnly ? '50 27 140 130' : '0 0 240 240'} aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#ffb45d" /><stop offset="1" stopColor="#ff701f" /></linearGradient></defs>
    {!faceOnly && <>
      <ellipse className="spark-shadow" cx="120" cy="221" rx="57" ry="8" fill="#000" opacity=".22" />
      <g className="spark-body">
        <path d="M82 163 76 210q-1 10 13 10h19l6-41m44-16 6 47q1 10-13 10h-19l-6-41" fill="#252528" stroke="#101113" strokeWidth="5" strokeLinejoin="round" />
        <path d="M80 211h27m27 0h26" stroke="#ff802c" strokeWidth="5" strokeLinecap="round" />
        <path d="M79 131q-24-2-32 17l-10 19q-5 10 6 15t17-6l18-22m83-23q24-2 32 17l10 19q5 10-6 15t-17-6l-18-22" fill={`url(#${id})`} stroke="#9c400f" strokeWidth="3" />
        <path d="M76 127h88l-4 43q-2 25-40 25t-40-25Z" fill={`url(#${id})`} stroke="#ae4a12" strokeWidth="3" />
        <path d="m120 146-15 20h13l-1 15 18-23h-13l3-12Z" fill="#29180f" />
      </g>
    </>}
    <g className="spark-head">
      <path d="M58 88q0-30 26-39l9-20 25 15q18-10 31-14l3 22q30 9 30 39v25q0 35-62 35t-62-35Z" fill={`url(#${id})`} stroke="#af4b16" strokeWidth="3" strokeLinejoin="round" />
      <path d="m94 31 6 22-17-2m51-5 13-12 2 20" fill="#ffd494" opacity=".75" />
      <path d="M70 91q0-19 22-19h56q22 0 22 19v21q0 22-50 22t-50-22Z" fill="#252322" stroke="#be5319" strokeWidth="3" />
      <path d="M80 88q5-7 14-7h49" fill="none" stroke="#53504c" strokeWidth="3" strokeLinecap="round" />
      <g className="spark-eyes" fill="#fff5dd"><rect x="88" y="92" width="16" height="21" rx="8" /><rect x="136" y="92" width="16" height="21" rx="8" /></g>
      <path d="M113 117q7 6 14 0" fill="none" stroke="#ffac5d" strokeWidth="3" strokeLinecap="round" />
      <path d="M69 106v10m102-10v10" stroke="#ffca80" strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>
}
