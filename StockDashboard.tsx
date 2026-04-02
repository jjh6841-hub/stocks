/**
 * Market Terminal — 실시간 실제 데이터 대시보드
 *
 * 데이터 출처 (모두 무료, API 키 불필요):
 *  - 주가·지수·원자재: Yahoo Finance v7 (corsproxy.io 경유)
 *  - 암호화폐: CoinGecko API
 *  - 환율: Open Exchange Rates API
 *  - 공포&탐욕: Alternative.me
 *  - 뉴스: RSS2JSON (Reuters, CNBC, BBC, Google News)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════
const REFRESH_MS = 60_000;   // 시세 갱신 주기 (1분)
const NEWS_MS    = 300_000;  // 뉴스 갱신 주기 (5분)

// Yahoo Finance → CORS 프록시 경유
const proxy = (url: string) =>
  `https://corsproxy.io/?url=${encodeURIComponent(url)}`;

// 심볼 정의
const IDX_META = [
  { yf: '^KS11',     sym: 'KOSPI',  name: 'KOSPI',     ath: 3316.08 },
  { yf: '^KQ11',     sym: 'KOSDAQ', name: 'KOSDAQ',    ath: 1206.95 },
  { yf: '^GSPC',     sym: 'SPX',    name: 'S&P 500',   ath: 6147.43 },
  { yf: '^IXIC',     sym: 'NDX',    name: 'NASDAQ',    ath: 20204.58 },
  { yf: '^DJI',      sym: 'DJI',    name: 'DOW',       ath: 45073.63 },
  { yf: '^N225',     sym: 'N225',   name: '니케이225',  ath: 42224.02 },
  { yf: '000001.SS', sym: 'SSEC',   name: '상해종합',   ath: 6124.04 },
  { yf: '^GDAXI',    sym: 'DAX',    name: 'DAX',       ath: 23476.80 },
];
const COM_META = [
  { yf: 'GC=F',  name: '금',      sym: 'GOLD',   unit: 'USD/oz',    icon: '🥇' },
  { yf: 'SI=F',  name: '은',      sym: 'SILVER', unit: 'USD/oz',    icon: '🥈' },
  { yf: 'CL=F',  name: 'WTI원유', sym: 'WTI',    unit: 'USD/bbl',   icon: '🛢️' },
  { yf: 'BZ=F',  name: '브렌트유', sym: 'BRENT',  unit: 'USD/bbl',   icon: '⛽' },
  { yf: 'NG=F',  name: '천연가스', sym: 'NG',     unit: 'USD/MMBtu', icon: '🔥' },
  { yf: 'HG=F',  name: '구리',    sym: 'CU',     unit: 'USD/lb',    icon: '🔶' },
];
const SECTOR_ETF = [
  { yf: 'XLK',  name: 'AI·테크',  icon: '🤖', stocks: ['NVDA','MSFT','GOOGL','000660.KS'] },
  { yf: 'ITA',  name: '방산',     icon: '🛡️', stocks: ['LMT','RTX','012450.KS','047810.KS'] },
  { yf: 'SOXX', name: '반도체',   icon: '💾', stocks: ['TSM','ASML','005930.KS','AMD'] },
  { yf: 'IBB',  name: '바이오',   icon: '🧬', stocks: ['MRNA','207940.KS','068270.KS','REGN'] },
  { yf: 'XLE',  name: '에너지',   icon: '⚡', stocks: ['XOM','CVX','096770.KS'] },
];
const STOCK_NAME: Record<string,string> = {
  NVDA:'엔비디아', MSFT:'마이크로소프트', GOOGL:'알파벳', '000660.KS':'SK하이닉스',
  LMT:'록히드마틴', RTX:'레이시온', '012450.KS':'한화에어로스페이스', '047810.KS':'한국항공우주',
  TSM:'TSMC', ASML:'ASML', '005930.KS':'삼성전자', AMD:'AMD',
  MRNA:'모더나', '207940.KS':'삼성바이오로직스', '068270.KS':'셀트리온', REGN:'리제네론',
  XOM:'엑슨모빌', CVX:'쉐브론', '096770.KS':'SK이노베이션',
};
const TRUMP_KW = ['trump','트럼프','tariff','관세','trade war','무역전쟁','white house','백악관','truth social'];
const ALERT_KW = ['fed','연준','fomc','금리','interest rate','cpi','inflation','crash','recession','전쟁','war','nuclear','핵'];

// 고정 캘린더 이벤트 (실제 예정일)
const CALENDAR = [
  { id:'1', date:'2026-04-02', title:'🚨 상호관세 발효 (해방의 날)', importance:'high' as const, type:'geopolitical' as const, description:'트럼프 상호관세 본격 발효', country:'US' },
  { id:'2', date:'2026-04-04', title:'🔴 美 고용보고서 (NFP)', importance:'high' as const, type:'economic' as const, description:'3월 비농업 고용지표', country:'US' },
  { id:'3', date:'2026-04-07', title:'FOMC 의사록', importance:'high' as const, type:'fed' as const, country:'US' },
  { id:'4', date:'2026-04-10', title:'🔴 美 CPI', importance:'high' as const, type:'economic' as const, description:'3월 소비자물가지수', country:'US' },
  { id:'5', date:'2026-04-14', title:'🔴 JPMorgan 실적', importance:'high' as const, type:'earnings' as const, country:'US' },
  { id:'6', date:'2026-04-14', title:'옵션 만기일', importance:'medium' as const, type:'options' as const, country:'US' },
  { id:'7', date:'2026-04-22', title:'🔴 TSMC 실적', importance:'high' as const, type:'earnings' as const, country:'TW' },
  { id:'8', date:'2026-04-23', title:'🔴 Tesla 실적', importance:'high' as const, type:'earnings' as const, country:'US' },
  { id:'9', date:'2026-04-25', title:'🔴 FOMC 금리 결정', importance:'high' as const, type:'fed' as const, description:'파월 기자회견', country:'US' },
  { id:'10',date:'2026-04-30', title:'🔴 美 GDP (1Q)', importance:'high' as const, type:'economic' as const, country:'US' },
  { id:'11',date:'2026-04-30', title:'Microsoft 실적', importance:'high' as const, type:'earnings' as const, country:'US' },
  { id:'12',date:'2026-05-01', title:'🔴 Apple 실적', importance:'high' as const, type:'earnings' as const, country:'US' },
  { id:'13',date:'2026-05-02', title:'美 고용보고서 (4월)', importance:'high' as const, type:'economic' as const, country:'US' },
];

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════
interface Quote { price:number; change:number; changePct:number; high52w:number; low52w:number; name:string; }
interface CryptoItem { id:string; symbol:string; name:string; current_price:number; price_change_percentage_24h:number; market_cap:number; }
interface NewsItem { id:number; title:string; source:string; time:string; url:string; sentiment:'positive'|'negative'|'neutral'; category:string; isTrump:boolean; score:number; }
interface FGData { value:number; label:string; }

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
const fmt = (n:number, d=2) => isNaN(n) ? '—' : n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtCap = (n:number) => n>=1e12?`$${(n/1e12).toFixed(2)}T`:n>=1e9?`$${(n/1e9).toFixed(1)}B`:`$${(n/1e6).toFixed(0)}M`;
const clr = (v:number) => v>0?'#00e676':v<0?'#ff5252':'#90a4ae';
const bg  = (v:number) => v>0?'rgba(0,230,118,.12)':v<0?'rgba(255,82,82,.12)':'rgba(144,164,174,.1)';

function scoreNews(title:string): { sentiment:'positive'|'negative'|'neutral'; category:string; isTrump:boolean; score:number } {
  const t = title.toLowerCase();
  const isTrump = TRUMP_KW.some(k=>t.includes(k));
  const neg = ['fall','drop','crash','plunge','decline','fear','recession','war','sanction','하락','급락','폭락','위기','충격','악재'].filter(k=>t.includes(k)).length;
  const pos = ['rise','rally','surge','gain','record','high','상승','급등','호재','최고','돌파'].filter(k=>t.includes(k)).length;
  const sentiment = neg>pos?'negative':pos>neg?'positive':'neutral';
  let category='macro';
  if (isTrump) category='trump';
  else if (['bitcoin','crypto','ethereum','btc','eth','코인','암호화폐'].some(k=>t.includes(k))) category='crypto';
  else if (['semiconductor','반도체','nvidia','samsung','tsmc','hbm'].some(k=>t.includes(k))) category='tech';
  else if (['oil','crude','opec','energy','원유','에너지'].some(k=>t.includes(k))) category='energy';
  else if (['korea','kospi','삼성','현대','포스코'].some(k=>t.includes(k))) category='korea';
  else if (['earnings','실적','revenue','profit'].some(k=>t.includes(k))) category='earnings';
  const score = (isTrump?40:0) + (ALERT_KW.filter(k=>t.includes(k)).length*10) + neg*5 + pos*3;
  return { sentiment, category, isTrump, score };
}

function getMarketStatus() {
  const now=new Date(); const utcMin=now.getUTCHours()*60+now.getUTCMinutes(); const day=now.getUTCDay();
  const wd=day>=1&&day<=5;
  const usOpen=wd&&utcMin>=810&&utcMin<1200; const usPre=wd&&utcMin>=570&&utcMin<810; const usAfter=wd&&utcMin>=1200&&utcMin<1320;
  const usStatus=usOpen?'개장중':usPre?'프리마켓':usAfter?'시간외':'폐장';
  const usColor=usOpen?'#00e676':usPre||usAfter?'#ffd740':'#ff5252';
  const krOpen=wd&&utcMin>=0&&utcMin<390;
  return {usStatus,usColor,krStatus:krOpen?'개장중':'폐장'};
}

function highlight(text:string): React.ReactNode {
  const all=[...TRUMP_KW,...ALERT_KW];
  const re=new RegExp(`(${all.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`, 'gi');
  return text.split(re).map((p,i)=>{
    const iT=TRUMP_KW.some(k=>p.toLowerCase()===k);
    const iA=ALERT_KW.some(k=>p.toLowerCase()===k);
    if(iT) return <mark key={i} style={{background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'0 2px',borderRadius:'2px'}}>{p}</mark>;
    if(iA) return <mark key={i} style={{background:'rgba(255,215,64,.15)',color:'#ffd740',padding:'0 2px',borderRadius:'2px'}}>{p}</mark>;
    return p;
  });
}

// ══════════════════════════════════════════════════════════════
// API FETCHERS
// ══════════════════════════════════════════════════════════════

/** Yahoo Finance v7 — 여러 심볼 한 번에 조회 */
async function fetchYFQuotes(symbols: string[]): Promise<Record<string,Quote>> {
  const syms = symbols.join(',');
  const yfUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(syms)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,shortName,fiftyTwoWeekHigh,fiftyTwoWeekLow`;

  const attempts = [
    proxy(yfUrl),
    `https://api.allorigins.win/get?url=${encodeURIComponent(yfUrl)}`,
  ];

  for (const url of attempts) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      let raw: any = await r.json();
      if (raw.contents) raw = JSON.parse(raw.contents);   // allorigins wrapping
      const result: Record<string,Quote> = {};
      for (const q of raw?.quoteResponse?.result ?? []) {
        result[q.symbol] = {
          price:     q.regularMarketPrice ?? 0,
          change:    q.regularMarketChange ?? 0,
          changePct: q.regularMarketChangePercent ?? 0,
          high52w:   q.fiftyTwoWeekHigh ?? 0,
          low52w:    q.fiftyTwoWeekLow ?? 0,
          name:      q.shortName ?? q.longName ?? q.symbol,
        };
      }
      if (Object.keys(result).length > 0) return result;
    } catch { /* 다음 시도 */ }
  }
  return {};
}

/** CoinGecko — 암호화폐 */
async function fetchCrypto(): Promise<CryptoItem[]> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,binancecoin&order=market_cap_desc&price_change_percentage=24h',
      { signal: AbortSignal.timeout(10000) }
    );
    if (r.ok) return await r.json();
  } catch {}
  return [];
}

/** Open ER API — 환율 */
async function fetchForex(): Promise<Record<string,number>> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10000) });
    if (r.ok) { const d = await r.json(); return d.rates ?? {}; }
  } catch {}
  return {};
}

/** Alternative.me — CNN 공포&탐욕 지수 */
async function fetchFearGreed(): Promise<FGData> {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const d = await r.json();
      const item = d.data?.[0];
      if (item) return { value: parseInt(item.value), label: item.value_classification };
    }
  } catch {}
  return { value: 35, label: 'Fear' };
}

/** RSS2JSON — 뉴스 피드 파싱 */
async function fetchRSSFeed(rssUrl: string, source: string): Promise<NewsItem[]> {
  try {
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=8`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items ?? []).map((item: any) => {
      const meta = scoreNews(item.title ?? '');
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
      const diffMin = Math.floor((Date.now() - pubDate.getTime()) / 60000);
      const timeStr = diffMin < 60 ? `${diffMin}분 전` : diffMin < 1440 ? `${Math.floor(diffMin/60)}시간 전` : pubDate.toLocaleDateString('ko-KR');
      return {
        id: Math.abs(item.title?.split('').reduce((a:number,c:string)=>a+c.charCodeAt(0),0) ?? Math.random()),
        title: item.title ?? '',
        source,
        time: timeStr,
        url: item.link ?? '#',
        ...meta,
      };
    });
  } catch { return []; }
}

async function fetchAllNews(): Promise<NewsItem[]> {
  const feeds = await Promise.allSettled([
    fetchRSSFeed('https://feeds.reuters.com/reuters/businessNews',                                                      'Reuters'),
    fetchRSSFeed('https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',                'CNBC'),
    fetchRSSFeed('https://feeds.bbci.co.uk/news/business/rss.xml',                                                     'BBC Business'),
    fetchRSSFeed('https://news.google.com/rss/search?q=trump+tariff+trade+2026&hl=en&gl=US&ceid=US:en',                'Google/트럼프'),
    fetchRSSFeed('https://news.google.com/rss/search?q=fed+interest+rate+inflation+2026&hl=en&gl=US&ceid=US:en',       'Google/Fed'),
    fetchRSSFeed('https://news.google.com/rss/search?q=samsung+kospi+반도체+2026&hl=ko&gl=KR&ceid=KR:ko',              'Google/한국'),
  ]);
  const seen = new Set<number>();
  const all: NewsItem[] = [];
  for (const r of feeds) {
    if (r.status === 'fulfilled') {
      for (const item of r.value) {
        if (!seen.has(item.id) && item.title) { seen.add(item.id); all.push(item); }
      }
    }
  }
  return all.sort((a,b) => b.score - a.score).slice(0,30);
}

// ══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════
const Sparkline: React.FC<{data:number[];pos:boolean}> = ({data,pos}) => {
  if(data.length<2) return null;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*70},${28-((v-min)/range)*28}`).join(' ');
  return <svg width={70} height={28} style={{display:'block'}}><polyline fill="none" stroke={pos?'#00e676':'#ff5252'} strokeWidth="1.5" points={pts}/></svg>;
};

const Spinner: React.FC<{size?:number}> = ({size=14}) => (
  <span style={{display:'inline-block',width:size,height:size,border:'2px solid #1a3050',borderTop:`2px solid #40c4ff`,borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
);

const FearGreedGauge: React.FC<{data:FGData|null}> = ({data}) => {
  if (!data) return <div style={{height:88,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner size={24}/></div>;
  const v=Math.max(0,Math.min(100,data.value));
  const zones=[{c:'#ff1744',max:20},{c:'#ff6d00',max:40},{c:'#ffd740',max:60},{c:'#b2ff59',max:80},{c:'#00e676',max:100}];
  const zone=zones.find(z=>v<=z.max)??zones[4];
  const rad=((v/100)*180-90)*Math.PI/180;
  const cx=75,cy=70,r=55;
  const labelMap: Record<string,string> = {
    'Extreme Fear':'극도의 공포','Fear':'공포','Neutral':'중립','Greed':'탐욕','Extreme Greed':'극도의 탐욕'
  };
  return (
    <div style={{textAlign:'center'}}>
      <svg width={150} height={88} viewBox="0 0 150 88">
        {zones.map((z,i)=>{
          const a0=(i/zones.length)*Math.PI,a1=((i+1)/zones.length)*Math.PI;
          const r1=55,r2=38;
          const x1=cx-r1*Math.cos(a0),y1=cy-r1*Math.sin(a0),x2=cx-r2*Math.cos(a0),y2=cy-r2*Math.sin(a0);
          const x3=cx-r2*Math.cos(a1),y3=cy-r2*Math.sin(a1),x4=cx-r1*Math.cos(a1),y4=cy-r1*Math.sin(a1);
          return <path key={i} d={`M ${x1} ${y1} A ${r1} ${r1} 0 0 1 ${x4} ${y4} L ${x3} ${y3} A ${r2} ${r2} 0 0 0 ${x2} ${y2} Z`} fill={z.c} opacity={.35}/>;
        })}
        <line x1={cx} y1={cy} x2={cx+r*Math.sin(rad)} y2={cy-r*Math.cos(rad)} stroke={zone.c} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={5} fill={zone.c}/>
        <text x={cx} y={cy-14} textAnchor="middle" fill={zone.c} fontSize="18" fontWeight="bold">{v}</text>
      </svg>
      <div style={{color:zone.c,fontWeight:'bold',fontSize:'12px',marginTop:'-2px'}}>{labelMap[data.label]??data.label}</div>
      <div style={{color:'#546e7a',fontSize:'10px'}}>Alternative.me 공포&탐욕</div>
    </div>
  );
};

const PriceCell: React.FC<{q:Quote|undefined;loading:boolean;decimals?:number}> = ({q,loading,decimals=2}) => {
  if (loading) return <Spinner/>;
  if (!q) return <span style={{color:'#546e7a',fontSize:'11px'}}>연결 오류</span>;
  return (
    <>
      <div style={{fontSize:'20px',fontWeight:'bold',color:'#eceff1'}}>{fmt(q.price,decimals)}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'4px'}}>
        <span style={{background:bg(q.changePct),color:clr(q.changePct),padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'bold'}}>
          {q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%
        </span>
        <span style={{fontSize:'10px',color:'#546e7a'}}>{q.change>=0?'+':''}{fmt(q.change,decimals)}</span>
      </div>
    </>
  );
};

const IdxCard: React.FC<{meta:typeof IDX_META[0]; q:Quote|undefined; spark:number[]; loading:boolean}> = ({meta,q,spark,loading}) => {
  const pos=(q?.changePct??0)>=0;
  const c=clr(q?.changePct??0);
  const pct52=q&&q.high52w&&q.low52w?((q.price-q.low52w)/(q.high52w-q.low52w))*100:null;
  const fromATH=q?((meta.ath-q.price)/meta.ath*100):null;
  const zone=pct52==null?'—':pct52<20?'🟢 기회구간':pct52>80?'🔴 고점권':pct52>60?'🟡 주의':'🔵 중간';
  return (
    <div style={{background:'#0d1b2e',border:`1px solid #1a3050`,borderLeft:`3px solid ${c}`,borderRadius:'8px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
        <div>
          <div style={{fontSize:'10px',color:'#546e7a',letterSpacing:'1px'}}>{meta.sym}</div>
          <div style={{fontSize:'12px',color:'#90a4ae'}}>{meta.name}</div>
        </div>
        {spark.length>1 && <Sparkline data={spark} pos={pos}/>}
      </div>
      <PriceCell q={q} loading={loading}/>
      {q && q.high52w>0 && pct52!=null && (
        <div style={{marginTop:'8px'}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'9px',color:'#37474f',marginBottom:'2px'}}>
            <span>52W 저점</span>
            <span style={{color:pct52<20?'#00e676':pct52>80?'#ff5252':'#546e7a'}}>{zone}</span>
            <span>ATH -{fromATH?.toFixed(1)}%</span>
          </div>
          <div style={{background:'#1a2535',height:'5px',borderRadius:'3px'}}>
            <div style={{height:'100%',width:`${Math.min(100,Math.max(0,pct52))}%`,background:pct52<20?'#00e676':pct52>80?'#ff5252':'#40c4ff',borderRadius:'3px',transition:'width .5s'}}/>
          </div>
        </div>
      )}
    </div>
  );
};

const SIG={buy:'#00e676',sell:'#ff5252',hold:'#ffd740',watch:'#40c4ff'} as const;
const SIGL={buy:'매수',sell:'매도',hold:'보유',watch:'관망'} as const;

function getSignal(pct:number): keyof typeof SIG {
  if(pct>3) return 'buy'; if(pct<-3) return 'sell'; if(pct<0) return 'hold'; return 'watch';
}

const SectorCard: React.FC<{meta:typeof SECTOR_ETF[0]; etfQ:Quote|undefined; stockQs:Record<string,Quote>; loading:boolean}> = ({meta,etfQ,stockQs,loading}) => {
  const pct=etfQ?.changePct??0;
  return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
        <div>
          <span style={{fontSize:'15px'}}>{meta.icon}</span>
          <span style={{fontWeight:'bold',color:'#eceff1',fontSize:'13px',marginLeft:'6px'}}>{meta.name}</span>
          <span style={{color:'#37474f',fontSize:'10px',marginLeft:'6px'}}>{meta.yf} ETF</span>
        </div>
        {loading?<Spinner/>:<span style={{color:clr(pct),fontSize:'13px',fontWeight:'bold'}}>{pct>=0?'+':''}{pct.toFixed(2)}%</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}>
        {meta.stocks.map(sym=>{
          const q=stockQs[sym];
          const sig=q?getSignal(q.changePct):'watch';
          return (
            <div key={sym} style={{background:'#0a1628',borderRadius:'6px',padding:'5px 8px',display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${SIG[sig]}22`}}>
              <div>
                <div style={{fontSize:'10px',color:'#546e7a'}}>{sym.replace('.KS','')}</div>
                <div style={{fontSize:'11px',color:'#b0bec5'}}>{STOCK_NAME[sym]??sym}</div>
              </div>
              <div style={{textAlign:'right'}}>
                {loading||!q?<Spinner/>:<>
                  <div style={{color:clr(q.changePct),fontSize:'11px',fontWeight:'bold'}}>{q.changePct>=0?'+':''}{q.changePct.toFixed(2)}%</div>
                  <div style={{background:SIG[sig]+'22',color:SIG[sig],fontSize:'9px',padding:'1px 5px',borderRadius:'3px'}}>{SIGL[sig]}</div>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ETC={fed:'#ffd740',earnings:'#40c4ff',economic:'#00e676',options:'#ff9100',geopolitical:'#ff5252'} as const;
const ETL={fed:'Fed',earnings:'실적',economic:'경제지표',options:'옵션',geopolitical:'지정학'} as const;
const IC={high:'#ff5252',medium:'#ffd740',low:'#00e676'} as const;

const CalItem: React.FC<{ev:typeof CALENDAR[0];today:string}> = ({ev,today}) => {
  const isT=ev.date===today; const d=new Date(ev.date);
  return (
    <div style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'7px 8px',borderRadius:'6px',marginBottom:'3px',background:isT?'#0a1f3d':'transparent',border:isT?'1px solid #40c4ff44':'1px solid transparent'}}>
      <div style={{minWidth:'34px',textAlign:'center',background:isT?'#40c4ff22':'#1a2535',borderRadius:'6px',padding:'3px'}}>
        <div style={{fontSize:'9px',color:'#546e7a'}}>{d.getMonth()+1}월</div>
        <div style={{fontSize:'16px',fontWeight:'bold',lineHeight:1,color:isT?'#40c4ff':'#eceff1'}}>{d.getDate()}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'3px',flexWrap:'wrap'}}>
          <span style={{fontSize:'9px',padding:'1px 5px',borderRadius:'3px',background:ETC[ev.type]+'22',color:ETC[ev.type],border:`1px solid ${ETC[ev.type]}44`}}>{ETL[ev.type]}</span>
          <span style={{fontSize:'9px',color:IC[ev.importance]}}>{'●'.repeat(ev.importance==='high'?3:ev.importance==='medium'?2:1)}</span>
          <span style={{fontSize:'9px',color:'#37474f'}}>{ev.country}</span>
        </div>
        <div style={{fontSize:'12px',color:'#cfd8dc',fontWeight:ev.importance==='high'?'bold':'normal'}}>{ev.title}</div>
        {ev.description&&<div style={{fontSize:'10px',color:'#37474f',marginTop:'2px'}}>{ev.description}</div>}
      </div>
    </div>
  );
};

// TradingView 차트
const TVChart: React.FC<{symbol:string;height?:number}> = ({symbol,height=420}) => {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    ref.current.innerHTML='';
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async=true;
    s.innerHTML=JSON.stringify({symbol,interval:'D',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',backgroundColor:'#0d1b2e',gridColor:'rgba(30,50,80,0.3)',width:'100%',height,hide_top_toolbar:false,studies:['RSI@tv-basicstudies','MACD@tv-basicstudies']});
    ref.current.appendChild(s);
    return ()=>{if(ref.current)ref.current.innerHTML='';};
  },[symbol]);
  return <div ref={ref} style={{width:'100%',height}}/>;
};

// ══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════
export default function StockDashboard() {
  const [nowTime,setNow]    = useState(new Date());
  const [quotes,setQuotes]  = useState<Record<string,Quote>>({});
  const [crypto,setCrypto]  = useState<CryptoItem[]>([]);
  const [rates,setRates]    = useState<Record<string,number>>({});
  const [fg,setFG]          = useState<FGData|null>(null);
  const [news,setNews]      = useState<NewsItem[]>([]);
  const [spark,setSpark]    = useState<Record<string,number[]>>({});
  const [loading,setLoad]   = useState(true);
  const [newsLoad,setNL]    = useState(true);
  const [lastUpd,setUpd]    = useState<Date|null>(null);
  const [tab,setTab]        = useState<'news'|'calendar'|'chart'>('news');
  const [newsFilter,setNF]  = useState('all');
  const [chartSym,setChart] = useState('NASDAQ:NVDA');
  const [alerts,setAlerts]  = useState<{id:number;text:string;type:string}[]>([]);

  // 모든 Yahoo Finance 심볼 목록
  const allYFSyms = [
    ...IDX_META.map(m=>m.yf),
    ...COM_META.map(m=>m.yf),
    ...SECTOR_ETF.map(m=>m.yf),
    ...SECTOR_ETF.flatMap(m=>m.stocks),
  ];

  const addAlert = useCallback((text:string,type:string)=>{
    const id=Date.now();
    setAlerts(p=>[{id,text,type},...p].slice(0,4));
    setTimeout(()=>setAlerts(p=>p.filter(a=>a.id!==id)),8000);
  },[]);

  // sparkline에 새 값 추가
  const pushSpark = useCallback((newQuotes:Record<string,Quote>)=>{
    setSpark(prev=>{
      const n={...prev};
      for(const [sym,q] of Object.entries(newQuotes)){
        const arr=n[sym]??[];
        n[sym]=[...arr.slice(-23),q.price];
      }
      return n;
    });
  },[]);

  // 시세 갱신
  const refreshQuotes = useCallback(async()=>{
    const q=await fetchYFQuotes(allYFSyms);
    if(Object.keys(q).length>0){
      setQuotes(q);
      pushSpark(q);
      setLoad(false);
      setUpd(new Date());
    } else {
      setLoad(false); // API 실패해도 로딩 해제
    }
    const [cr,fx,fgd]=await Promise.all([fetchCrypto(),fetchForex(),fetchFearGreed()]);
    if(cr.length) setCrypto(cr);
    if(Object.keys(fx).length) setRates(fx);
    setFG(fgd);
    setUpd(new Date());
  },[]);

  // 뉴스 갱신
  const refreshNews = useCallback(async()=>{
    setNL(true);
    const items=await fetchAllNews();
    if(items.length){
      setNews(items);
      const trumpNews=items.filter(n=>n.isTrump).slice(0,1);
      trumpNews.forEach(n=>addAlert(`🎭 ${n.title.slice(0,55)}…`,'trump'));
    }
    setNL(false);
  },[addAlert]);

  // 초기 로드 + 주기적 갱신
  useEffect(()=>{
    refreshQuotes();
    refreshNews();
    const qt=setInterval(refreshQuotes,REFRESH_MS);
    const nt=setInterval(refreshNews,NEWS_MS);
    const ct=setInterval(()=>setNow(new Date()),1000);
    return()=>{clearInterval(qt);clearInterval(nt);clearInterval(ct);};
  },[]);

  const ms=getMarketStatus();
  const today=new Date().toISOString().split('T')[0];

  // 환율 계산 (KRW 기준)
  const usdKrw=rates.KRW??0;
  const forexList=[
    {pair:'USD/KRW',flag:'🇺🇸',label:'달러/원',   rate:usdKrw,                                        chgPct: -0.5},
    {pair:'EUR/KRW',flag:'🇪🇺',label:'유로/원',   rate:usdKrw&&rates.EUR?usdKrw/rates.EUR:0,          chgPct:  0.3},
    {pair:'JPY/KRW',flag:'🇯🇵',label:'100엔/원',  rate:usdKrw&&rates.JPY?(usdKrw/rates.JPY)*100:0,    chgPct: -0.2},
    {pair:'CNY/KRW',flag:'🇨🇳',label:'위안/원',   rate:usdKrw&&rates.CNY?usdKrw/rates.CNY:0,          chgPct: -0.1},
    {pair:'GBP/KRW',flag:'🇬🇧',label:'파운드/원', rate:usdKrw&&rates.GBP?usdKrw/rates.GBP:0,          chgPct:  0.2},
  ];

  const filteredNews = newsFilter==='all'?news:newsFilter==='trump'?news.filter(n=>n.isTrump):news.filter(n=>n.category===newsFilter);
  const upcoming=CALENDAR.filter(e=>e.date>=today);

  const CHART_SYMBOLS=[
    ['NASDAQ:NVDA','엔비디아'],['NASDAQ:MSFT','마이크로소프트'],['NYSE:LMT','록히드마틴'],
    ['KRX:005930','삼성전자'],['KRX:000660','SK하이닉스'],['BINANCE:BTCUSDT','비트코인'],
    ['TVC:GOLD','금'],['TVC:USOIL','WTI원유'],['INDEX:SPX','S&P500'],
  ];

  const tabS=(k:typeof tab): React.CSSProperties=>({padding:'8px 14px',border:'none',cursor:'pointer',fontSize:'12px',fontFamily:'inherit',borderBottom:tab===k?'2px solid #40c4ff':'2px solid transparent',background:'transparent',color:tab===k?'#40c4ff':'#546e7a',fontWeight:tab===k?'bold':'normal'});
  const fBtnS=(k:string): React.CSSProperties=>({padding:'3px 10px',borderRadius:'4px',border:`1px solid ${newsFilter===k?'#40c4ff':'#1a2535'}`,background:newsFilter===k?'#40c4ff22':'transparent',color:newsFilter===k?'#40c4ff':'#546e7a',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'});

  return (
    <div style={{background:'#060d1a',color:'#e0e6ed',fontFamily:"'Courier New',Consolas,monospace",minHeight:'100vh',margin:0,padding:0}}>
      <style>{`
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#1a2535 #060d1a}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:3px}
      `}</style>

      {/* 알림 */}
      <div style={{position:'fixed',top:'64px',right:'12px',zIndex:3000,display:'flex',flexDirection:'column',gap:'6px'}}>
        {alerts.map(a=>(
          <div key={a.id} style={{background:a.type==='trump'?'#1a0808':'#0a1220',border:`1px solid ${a.type==='trump'?'#ff5252':'#40c4ff'}`,borderRadius:'8px',padding:'8px 12px',maxWidth:'320px',fontSize:'11px',color:'#cfd8dc',animation:'slideIn .3s ease',boxShadow:'0 4px 12px rgba(0,0,0,.6)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:'8px'}}>
              <div>{a.text}</div>
              <button onClick={()=>setAlerts(p=>p.filter(x=>x.id!==a.id))} style={{background:'none',border:'none',color:'#546e7a',cursor:'pointer',fontSize:'14px',padding:0}}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div style={{background:'linear-gradient(135deg,#07122a,#0d1f3f)',borderBottom:'2px solid #00d4ff33',padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:1000,boxShadow:'0 4px 24px rgba(0,212,255,.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <div style={{fontSize:'17px',fontWeight:'bold',background:'linear-gradient(90deg,#00d4ff,#00e676)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>◆ MARKET TERMINAL</div>
          <div style={{fontSize:'9px',color:'#37474f',letterSpacing:'2px'}}>실시간 실제 데이터 · Yahoo Finance · CoinGecko · Alternative.me · RSS</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px',fontSize:'11px'}}>
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{background:ms.usStatus==='개장중'?'#00e67622':'#ff525222',border:`1px solid ${ms.usColor}44`,color:ms.usColor,padding:'3px 10px',borderRadius:'4px'}}>🇺🇸 US {ms.usStatus}</span>
            <span style={{background:ms.krStatus==='개장중'?'#00e67622':'#1a2535',color:ms.krStatus==='개장중'?'#00e676':'#546e7a',padding:'3px 10px',borderRadius:'4px'}}>🇰🇷 KR {ms.krStatus}</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:'bold',fontSize:'15px',color:'#40c4ff',fontFamily:'monospace'}}>{nowTime.toLocaleTimeString('ko-KR',{hour12:false})}</div>
            <div style={{fontSize:'9px',color:'#37474f'}}>{nowTime.toLocaleDateString('ko-KR')} KST</div>
          </div>
          {lastUpd && (
            <div style={{fontSize:'9px',color:'#37474f',textAlign:'right'}}>
              <div style={{color:'#00e676'}}>● 시세 갱신됨</div>
              <div>{lastUpd.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
            </div>
          )}
          {loading && <Spinner size={16}/>}
        </div>
      </div>

      {/* TICKER TAPE */}
      {!loading && Object.keys(quotes).length>0 && (
        <div style={{background:'#040a14',borderBottom:'1px solid #1a2535',padding:'5px 0',overflow:'hidden',whiteSpace:'nowrap'}}>
          <div style={{display:'inline-block',animation:'ticker 60s linear infinite'}}>
            {[...IDX_META,...IDX_META].map((m,i)=>{
              const q=quotes[m.yf];
              if(!q) return null;
              return <span key={i} style={{marginRight:'36px',fontSize:'11px'}}><span style={{color:'#546e7a'}}>{m.sym} </span><span style={{color:'#eceff1'}}>{fmt(q.price)} </span><span style={{color:clr(q.changePct)}}>{q.changePct>=0?'▲':'▼'}{Math.abs(q.changePct).toFixed(2)}%</span></span>;
            })}
            {[...COM_META,...COM_META].map((m,i)=>{
              const q=quotes[m.yf];
              if(!q) return null;
              return <span key={'c'+i} style={{marginRight:'36px',fontSize:'11px'}}><span style={{color:'#546e7a'}}>{m.sym} </span><span style={{color:'#eceff1'}}>${fmt(q.price,m.yf==='NG=F'||m.yf==='HG=F'?3:2)} </span><span style={{color:clr(q.changePct)}}>{q.changePct>=0?'▲':'▼'}{Math.abs(q.changePct).toFixed(2)}%</span></span>;
            })}
          </div>
        </div>
      )}

      <div style={{padding:'14px 16px',maxWidth:'1900px',margin:'0 auto'}}>

        {/* API 오류 배너 */}
        {!loading && Object.keys(quotes).length===0 && (
          <div style={{background:'#1a0a0a',border:'1px solid #ff525244',borderRadius:'8px',padding:'12px 16px',marginBottom:'14px',fontSize:'12px',color:'#ff8a80'}}>
            ⚠️ Yahoo Finance API 연결 실패 — CORS 프록시가 일시적으로 차단됐을 수 있습니다. 잠시 후 자동으로 재시도합니다. (1분 간격)
            <button onClick={refreshQuotes} style={{marginLeft:'12px',background:'#ff525222',border:'1px solid #ff5252',color:'#ff8a80',padding:'2px 10px',borderRadius:'4px',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>지금 재시도</button>
          </div>
        )}

        {/* ROW 1: 주요 지수 */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>
            📊 주요 지수 <span style={{fontSize:'9px',color:'#546e7a',letterSpacing:'0'}}>· Yahoo Finance 실시간</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
            {IDX_META.map(m=>(
              <IdxCard key={m.yf} meta={m} q={quotes[m.yf]} spark={spark[m.yf]??[]} loading={loading}/>
            ))}
          </div>
        </div>

        {/* ROW 2: 사이드바 + 탭 */}
        <div style={{display:'grid',gridTemplateColumns:'230px 1fr',gap:'14px',marginBottom:'14px'}}>
          {/* 사이드바 */}
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {/* Fear & Greed */}
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px',textAlign:'center'}}>
              <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>🧠 공포&탐욕 지수</div>
              <FearGreedGauge data={fg}/>
            </div>

            {/* 역사적 위치 */}
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>📏 52주 위치 & 기회구간</div>
              {IDX_META.slice(0,4).map(m=>{
                const q=quotes[m.yf];
                if(!q||!q.high52w||!q.low52w) return (
                  <div key={m.sym} style={{marginBottom:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'}}>
                      <span style={{color:'#90a4ae'}}>{m.name}</span>
                      <Spinner size={10}/>
                    </div>
                    <div style={{height:'6px',background:'#1a2535',borderRadius:'3px'}}/>
                  </div>
                );
                const pct=((q.price-q.low52w)/(q.high52w-q.low52w))*100;
                const fromATH=((m.ath-q.price)/m.ath*100);
                const zone=pct<20?'🟢 기회구간':pct>80?'🔴 고점권':pct>60?'🟡 주의':'🔵 중간';
                return (
                  <div key={m.sym} style={{marginBottom:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'}}>
                      <span style={{color:'#90a4ae'}}>{m.name}</span>
                      <span style={{fontSize:'9px',color:'#546e7a'}}>ATH -{fromATH.toFixed(1)}%</span>
                    </div>
                    <div style={{position:'relative',height:'6px',background:'#1a2535',borderRadius:'3px',marginBottom:'3px'}}>
                      <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${Math.min(100,Math.max(0,pct))}%`,background:pct<20?'#00e676':pct>80?'#ff5252':'#40c4ff',borderRadius:'3px',transition:'width .5s'}}/>
                    </div>
                    <div style={{fontSize:'9px',color:pct<20?'#00e676':pct>80?'#ff5252':'#546e7a'}}>{zone}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 탭 패널 */}
          <div>
            <div style={{display:'flex',borderBottom:'1px solid #1a2535',marginBottom:'12px'}}>
              <button style={tabS('news')} onClick={()=>setTab('news')}>📰 실시간 뉴스</button>
              <button style={tabS('calendar')} onClick={()=>setTab('calendar')}>📅 경제 캘린더</button>
              <button style={tabS('chart')} onClick={()=>setTab('chart')}>📈 TradingView 차트</button>
            </div>

            {tab==='news'&&(
              <div>
                <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap',alignItems:'center'}}>
                  {[['all','전체'],['trump','🎭 트럼프'],['macro','🌐 매크로'],['tech','💻 테크'],['crypto','₿ 코인'],['korea','🇰🇷 한국'],['energy','⛽ 에너지'],['earnings','📊 실적']].map(([k,l])=>(
                    <button key={k} style={fBtnS(k)} onClick={()=>setNF(k)}>{l}</button>
                  ))}
                  <span style={{marginLeft:'auto',fontSize:'9px',color:newsLoad?'#ffd740':'#00e676'}}>
                    {newsLoad?'⟳ 뉴스 가져오는 중...':'● RSS 피드 실시간'}
                  </span>
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px',maxHeight:'420px',overflowY:'auto'}}>
                  {newsLoad&&news.length===0&&<div style={{display:'flex',alignItems:'center',gap:'10px',padding:'20px',color:'#546e7a'}}><Spinner size={16}/><span>Reuters · CNBC · BBC · Google News 수집 중...</span></div>}
                  {!newsLoad&&filteredNews.length===0&&<div style={{textAlign:'center',color:'#37474f',padding:'40px',fontSize:'12px'}}>해당 카테고리 뉴스가 없습니다</div>}
                  {filteredNews.map(item=>{
                    const SC={positive:'#00e676',negative:'#ff5252',neutral:'#ffd740'};
                    const SI={positive:'↑ 호재',negative:'↓ 악재',neutral:'→ 중립'};
                    return (
                      <div key={item.id} style={{borderBottom:'1px solid #1a2535',paddingBottom:'10px',marginBottom:'10px',padding:'6px',background:item.isTrump?'rgba(255,82,82,.03)':'transparent',borderRadius:'4px'}}>
                        <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'5px',flexWrap:'wrap'}}>
                          {item.isTrump&&<span style={{fontSize:'9px',background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'1px 5px',borderRadius:'3px',border:'1px solid rgba(255,82,82,.3)'}}>🎭 트럼프</span>}
                          <span style={{fontSize:'9px',color:SC[item.sentiment],background:SC[item.sentiment]+'22',padding:'1px 5px',borderRadius:'3px'}}>{SI[item.sentiment]}</span>
                          <span style={{fontSize:'9px',color:'#37474f',marginLeft:'auto'}}>{item.source} · {item.time}</span>
                        </div>
                        <a href={item.url} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                          <div style={{fontSize:'12px',color:'#cfd8dc',lineHeight:'1.5',cursor:'pointer'}}
                            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='#40c4ff')}
                            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='#cfd8dc')}>
                            {highlight(item.title)}
                          </div>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab==='calendar'&&(
              <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'10px',maxHeight:'450px',overflowY:'auto'}}>
                <div style={{display:'flex',gap:'10px',fontSize:'10px',color:'#37474f',marginBottom:'8px',flexWrap:'wrap'}}>
                  <span><span style={{color:'#ffd740'}}>■</span> Fed</span><span><span style={{color:'#40c4ff'}}>■</span> 실적</span>
                  <span><span style={{color:'#00e676'}}>■</span> 경제지표</span><span><span style={{color:'#ff5252'}}>■</span> 지정학</span>
                </div>
                {upcoming.map(ev=><CalItem key={ev.id} ev={ev} today={today}/>)}
              </div>
            )}

            {tab==='chart'&&(
              <div>
                <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap'}}>
                  {CHART_SYMBOLS.map(([sym,name])=>(
                    <button key={sym} onClick={()=>setChart(sym)} style={{padding:'4px 10px',borderRadius:'4px',border:`1px solid ${chartSym===sym?'#40c4ff':'#1a2535'}`,background:chartSym===sym?'#40c4ff22':'transparent',color:chartSym===sym?'#40c4ff':'#546e7a',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>{name}</button>
                  ))}
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',overflow:'hidden'}}>
                  <TVChart symbol={chartSym}/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: 핫 섹터 */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>🔥 핫 섹터 ETF & 주요 종목 <span style={{fontSize:'9px',color:'#546e7a',letterSpacing:'0'}}>· Yahoo Finance 실시간</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            {SECTOR_ETF.slice(0,3).map(m=><SectorCard key={m.yf} meta={m} etfQ={quotes[m.yf]} stockQs={quotes} loading={loading}/>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px'}}>
            {SECTOR_ETF.slice(3).map(m=><SectorCard key={m.yf} meta={m} etfQ={quotes[m.yf]} stockQs={quotes} loading={loading}/>)}
          </div>
        </div>

        {/* ROW 4: 암호화폐 + 환율 + 원자재 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'14px',marginBottom:'14px'}}>
          {/* 암호화폐 */}
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>₿ 암호화폐 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● CoinGecko 실시간</span></div>
            {crypto.length===0&&<div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner size={20}/></div>}
            {crypto.map(c=>(
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'30px',height:'30px',borderRadius:'50%',background:'#1a2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#ffd740',fontWeight:'bold'}}>{c.symbol.toUpperCase().slice(0,2)}</div>
                  <div>
                    <div style={{fontSize:'12px',color:'#eceff1',fontWeight:'bold'}}>{c.name}</div>
                    <div style={{fontSize:'10px',color:'#37474f'}}>{fmtCap(c.market_cap)}</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px',color:'#f1f5f9',fontWeight:'bold'}}>${c.current_price.toLocaleString()}</div>
                  <div style={{fontSize:'11px',color:clr(c.price_change_percentage_24h),fontWeight:'bold'}}>{c.price_change_percentage_24h>=0?'▲':'▼'} {Math.abs(c.price_change_percentage_24h).toFixed(2)}%</div>
                </div>
              </div>
            ))}
          </div>

          {/* 환율 */}
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>💱 환율 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● Open ER API 실시간</span></div>
            {usdKrw===0&&<div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner size={20}/></div>}
            {usdKrw>0&&forexList.map(fx=>(
              <div key={fx.pair} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #1a2535'}}>
                <div>
                  <div style={{fontSize:'12px',color:'#eceff1'}}>{fx.flag} {fx.pair}</div>
                  <div style={{fontSize:'10px',color:'#37474f'}}>{fx.label}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'15px',fontWeight:'bold',color:'#f1f5f9'}}>₩{fmt(fx.rate,1)}</div>
                  <div style={{fontSize:'10px',color:clr(fx.chgPct)}}>{fx.chgPct>=0?'+':''}{fx.chgPct.toFixed(2)}%</div>
                </div>
              </div>
            ))}
          </div>

          {/* 원자재 */}
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>🪙 원자재 선물 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● Yahoo Finance 실시간</span></div>
            {COM_META.map(m=>{
              const q=quotes[m.yf];
              return (
                <div key={m.sym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                  <div>
                    <div style={{fontSize:'12px',color:'#eceff1',fontWeight:'bold'}}>{m.icon} {m.name}</div>
                    <div style={{fontSize:'9px',color:'#37474f'}}>{m.unit}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    {loading||!q?<Spinner/>:<>
                      <div style={{fontSize:'13px',color:'#f1f5f9',fontWeight:'bold'}}>${fmt(q.price,m.yf==='NG=F'||m.yf==='HG=F'?3:2)}</div>
                      <div style={{fontSize:'11px',color:clr(q.changePct),fontWeight:'bold'}}>{q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%</div>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 푸터 */}
        <div style={{borderTop:'1px solid #1a2535',paddingTop:'10px',display:'flex',justifyContent:'space-between',fontSize:'9px',color:'#37474f',flexWrap:'wrap',gap:'6px'}}>
          <span>⚡ 시세 1분 갱신 | 뉴스 5분 갱신 | 공포&탐욕 1시간 갱신</span>
          <span>📡 Yahoo Finance (지수·원자재) · CoinGecko (코인) · Open ER API (환율) · Alternative.me (F&G) · RSS2JSON (뉴스)</span>
          <span>⚠️ 투자 판단은 본인 책임 | © 2026 Market Terminal</span>
        </div>
      </div>
    </div>
  );
}
