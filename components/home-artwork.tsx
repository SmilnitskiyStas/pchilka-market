type ArtworkKind = 'catalog' | 'pin' | 'phone' | 'store' | 'map' | 'shopping' | 'rewards';

// Vector artwork keeps the layout complete until original campaign photos are supplied.
export default function HomeArtwork({ kind }: { kind: ArtworkKind }) {
  if (kind === 'phone') return (
    <div className="home-phone" aria-hidden="true">
      <div className="home-phone-screen">
        <span className="home-phone-notch" />
        <img src="/logo.png" alt="" />
        <span className="home-phone-crown">♛</span>
        <strong>до <b>3%</b><br />кешбеку</strong>
        <span className="home-phone-benefit">Акції · Бонуси · Відгуки</span>
        <span className="home-phone-card">Твоя картка<br />завжди поруч</span>
      </div>
    </div>
  );

  return (
    <svg viewBox="0 0 300 340" fill="none" aria-hidden="true" className={`home-artwork home-artwork-${kind}`}>
      <defs>
        <linearGradient id={`art-${kind}`} x1="30" y1="30" x2="270" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#b5ed43" /><stop offset=".5" stopColor="#62a61d" /><stop offset="1" stopColor="#123b25" /></linearGradient>
      </defs>
      {kind === 'pin' || kind === 'map' ? <>
        {kind === 'map' ? <g stroke="#b8cdac" strokeWidth="2" opacity=".5"><path d="m0 40 300 100M0 120l300 100M0 210l300 100M40 0l80 340M160 0l80 340M300 10 0 270M300 150 80 340" /></g> : null}
        <path d="M150 32c-62 0-109 46-109 105 0 74 109 172 109 172s109-98 109-172C259 78 212 32 150 32Z" fill={`url(#art-${kind})`} />
        <circle cx="150" cy="137" r="43" fill={kind === 'map' ? '#123b25' : 'white'} />
        <path d="M76 92c15-29 40-43 69-43" stroke="white" strokeOpacity=".65" strokeWidth="7" strokeLinecap="round" />
      </> : kind === 'catalog' ? <g transform="rotate(10 150 170)">
        <path d="M62 44h190v268H62z" fill="#e8f2dc" /><path d="M45 30h180v270H45z" fill="white" stroke="#d7dfcd" strokeWidth="2" />
        <path d="M45 83h180v28H45z" fill="#62a61d" /><text x="62" y="67" fill="#62a61d" fontSize="26" fontWeight="800">пчілка</text><text x="69" y="103" fill="white" fontSize="18" fontWeight="700">КАТАЛОГ АКЦІЙ</text>
        {[0, 1, 2].map((row) => [0, 1, 2].map((column) => <g key={`${row}-${column}`} transform={`translate(${62 + column * 52} ${130 + row * 53})`}><rect width="36" height="28" rx="8" fill={['#f5cb5c', '#b0d780', '#e8b58a'][column]} /><rect y="34" width="32" height="6" rx="3" fill="#c8d0c0" /><rect y="44" width="20" height="4" rx="2" fill="#62a61d" /></g>))}
      </g> : kind === 'store' ? <>
        <rect x="25" y="120" width="250" height="190" rx="8" fill="#e7eee1" /><path d="M16 100h268v46H16z" fill="#62a61d" /><text x="57" y="132" fill="white" fontSize="30" fontWeight="800">пчілка маркет</text>
        {[45, 115, 185].map((x) => <g key={x}><rect x={x} y="165" width="62" height="123" fill="#a6c6b4" /><path d={`m${x + 4} 173 50 60m-50-25 50 60`} stroke="white" strokeOpacity=".5" strokeWidth="3" /></g>)}
        <path d="M14 310h272" stroke="#2d5135" strokeWidth="10" />
      </> : kind === 'shopping' ? <>
        <circle cx="150" cy="83" r="36" fill="#f2d3a6" /><path d="M96 145q54-36 108 0l16 111H80z" fill="#f6f7f0" /><path d="m55 207 26 86h156l27-86H55Z" fill="#62a61d" /><path d="M73 232h170M83 257h150M110 209l10 80m38-80v80m42-80-10 80" stroke="#d5ebbf" strokeWidth="5" /><path d="m30 183 22 3 35 118h147" stroke="#2d5135" strokeWidth="8" strokeLinecap="round" /><circle cx="104" cy="320" r="10" fill="#2d5135" /><circle cx="221" cy="320" r="10" fill="#2d5135" />
      </> : <>
        <circle cx="150" cy="170" r="120" fill={`url(#art-${kind})`} /><rect x="49" y="108" width="202" height="130" rx="17" stroke="white" strokeWidth="5" /><path d="M49 147h202m-171 39h59m-59 22h32" stroke="white" strokeWidth="8" /><text x="159" y="214" fill="white" fontSize="48" fontWeight="800">3%</text>
      </>}
    </svg>
  );
}
