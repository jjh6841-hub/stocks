/**
 * MobileDashboard — Galaxy S25 (393px) 최적화
 * 데이터 공유: market-data.json (동일)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

const DATA_URL = './market-data.json';

const IDX_META = [
  { yf:'^KS11',     sym:'KOSPI',  name:'KOSPI',    ath:3316.08 },
  { yf:'^KQ11',     sym:'KOSDAQ', name:'KOSDAQ',   ath:1206.95 },
  { yf:'^GSPC',     sym:'SPX',    name:'S&P 500',  ath:6147.43 },
  { yf:'^IXIC',     sym:'NDX',    name:'NASDAQ',   ath:20204.58 },
  { yf:'^DJI',      sym:'DJI',    name:'DOW',      ath:45073.63 },
  { yf:'^N225',     sym:'N225',   name:'니케이225', ath:42224.02 },
  { yf:'000001.SS', sym:'SSEC',   name:'상해종합',  ath:6124.04 },
  { yf:'^GDAXI',    sym:'DAX',    name:'DAX',      ath:23476.80 },
];
const COM_META = [
  { yf:'GC=F', name:'금',      sym:'GOLD',  unit:'USD/oz',    icon:'🥇' },
  { yf:'SI=F', name:'은',      sym:'SILVER',unit:'USD/oz',    icon:'🥈' },
  { yf:'CL=F', name:'WTI원유', sym:'WTI',   unit:'USD/bbl',   icon:'🛢️' },
  { yf:'BZ=F', name:'브렌트유',sym:'BRENT', unit:'USD/bbl',   icon:'⛽' },
  { yf:'NG=F', name:'천연가스',sym:'NG',    unit:'USD/MMBtu', icon:'🔥' },
  { yf:'HG=F', name:'구리',    sym:'CU',    unit:'USD/lb',    icon:'🔶' },
];
const SECTOR_DEF = [
  { yf:'XLK',  name:'AI·테크', icon:'🤖', stocks:['NVDA','MSFT','GOOGL','000660.KS'] },
  { yf:'ITA',  name:'방산',    icon:'🛡️', stocks:['LMT','RTX','012450.KS','047810.KS'] },
  { yf:'SOXX', name:'반도체',  icon:'💾', stocks:['TSM','ASML','005930.KS','AMD'] },
  { yf:'IBB',  name:'바이오',  icon:'🧬', stocks:['MRNA','207940.KS','068270.KS','REGN'] },
  { yf:'XLE',  name:'에너지',  icon:'⚡', stocks:['XOM','CVX','096770.KS'] },
];
const STOCK_NAME: Record<string,string> = {
  NVDA:'엔비디아', MSFT:'마이크로소프트', GOOGL:'알파벳', '000660.KS':'SK하이닉스',
  LMT:'록히드마틴', RTX:'레이시온', '012450.KS':'한화에어로스페이스', '047810.KS':'한국항공우주',
  TSM:'TSMC', ASML:'ASML', '005930.KS':'삼성전자', AMD:'AMD',
  MRNA:'모더나', '207940.KS':'삼성바이오로직스', '068270.KS':'셀트리온', REGN:'리제네론',
  XOM:'엑슨모빌', CVX:'쉐브론', '096770.KS':'SK이노베이션',
};
const CALENDAR = [
  { id:'1', date:'2026-04-02', title:'상호관세 발효',         imp:'high', type:'geopolitical', desc:'전 세계 교역국 대상 상호관세' },
  { id:'2', date:'2026-04-04', title:'美 고용보고서 (NFP)',   imp:'high', type:'economic',     desc:'3월 비농업 고용지표' },
  { id:'3', date:'2026-04-07', title:'FOMC 의사록',          imp:'high', type:'fed',          desc:'3월 FOMC 의사록 공개' },
  { id:'4', date:'2026-04-10', title:'美 CPI',               imp:'high', type:'economic',     desc:'3월 소비자물가지수' },
  { id:'5', date:'2026-04-14', title:'JPMorgan 실적',        imp:'high', type:'earnings',     desc:'JP모건 1Q 실적' },
  { id:'6', date:'2026-04-14', title:'옵션 만기일',          imp:'med',  type:'options',      desc:'4월 월물 만기' },
  { id:'7', date:'2026-04-22', title:'TSMC 실적',            imp:'high', type:'earnings',     desc:'TSMC 1Q 실적' },
  { id:'8', date:'2026-04-23', title:'Tesla 실적',           imp:'high', type:'earnings',     desc:'Tesla 1Q 실적' },
  { id:'9', date:'2026-04-25', title:'FOMC 금리 결정',       imp:'high', type:'fed',          desc:'파월 기자회견' },
  { id:'10',date:'2026-04-30', title:'美 GDP 속보치',        imp:'high', type:'economic',     desc:'1Q GDP 잠정치' },
  { id:'11',date:'2026-04-30', title:'Microsoft 실적',       imp:'high', type:'earnings',     desc:'Microsoft 1Q 실적' },
  { id:'12',date:'2026-05-01', title:'Apple 실적',           imp:'high', type:'earnings',     desc:'Apple 2Q 실적' },
  { id:'13',date:'2026-05-02', title:'美 고용보고서 (4월)', imp:'high', type:'economic',     desc:'4월 비농업 고용지표' },
];
const EVT_COLOR: Record<string,string> = { fed:'#ffd740', earnings:'#40c4ff', economic:'#00e676', options:'#ff9100', geopolitical:'#ff5252' };
const EVT_LABEL: Record<string,string> = { fed:'Fed', earnings:'실적', economic:'경제지표', options:'옵션', geopolitical:'지정학' };
const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAYS_KO   = ['일','월','화','수','목','금','토'];

const ETF_DB = [
  { sym:'SPY',  name:'S&P500 ETF',  tag:'분산', color:'#40c4ff', desc:'미국 500대 기업 분산',  fgRange:[0,100] },
  { sym:'QQQ',  name:'나스닥100',    tag:'성장', color:'#00e676', desc:'빅테크·AI 집중',        fgRange:[45,80] },
  { sym:'XLK',  name:'AI·테크',      tag:'섹터', color:'#b39ddb', desc:'반도체·소프트웨어',     fgRange:[45,80] },
  { sym:'SOXX', name:'반도체 ETF',   tag:'테마', color:'#80deea', desc:'AI 인프라 수혜',        fgRange:[40,75] },
  { sym:'ITA',  name:'방위산업 ETF', tag:'방어', color:'#ffd740', desc:'지정학 리스크 헤지',    fgRange:[0,60] },
  { sym:'IBB',  name:'바이오 ETF',   tag:'테마', color:'#a5d6a7', desc:'신약·고령화 테마',      fgRange:[30,70] },
  { sym:'GLD',  name:'금 ETF',       tag:'헤지', color:'#ffe082', desc:'인플레·불확실성 헤지',  fgRange:[0,45] },
  { sym:'TLT',  name:'장기국채 ETF', tag:'채권', color:'#90a4ae', desc:'금리 하락 포지션',      fgRange:[0,40] },
];

interface Quote { price:number; change:number; changePct:number; high52w:number; low52w:number; }
interface MarketData {
  updatedAt:string; quotes:Record<string,Quote>; crypto:any[];
  forex:Record<string,number>; fearGreed:{value:number;label:string}; news:any[];
}

const fmt  = (n:number,d=2) => isNaN(n)||n===0?'—':n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtC = (n:number) => n>=1e12?`$${(n/1e12).toFixed(2)}T`:n>=1e9?`$${(n/1e9).toFixed(1)}B`:`$${(n/1e6).toFixed(0)}M`;
const clr  = (v:number) => v>0?'#00e676':v<0?'#ff5252':'#90a4ae';
const bg   = (v:number) => v>0?'rgba(0,230,118,.15)':v<0?'rgba(255,82,82,.15)':'rgba(144,164,174,.1)';

const TRUMP_KW = ['trump','트럼프','tariff','관세','trade war','white house','백악관'];
const ALERT_KW = ['fed','연준','fomc','금리','cpi','inflation','crash','recession','war'];
function highlight(text:string) {
  const all=[...TRUMP_KW,...ALERT_KW];
  const re=new RegExp(`(${all.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`, 'gi');
  return text.split(re).map((p,i) => {
    const t=p.toLowerCase();
    if(TRUMP_KW.some(k=>t===k)) return <mark key={i} style={{background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'0 2px',borderRadius:'2px'}}>{p}</mark>;
    if(ALERT_KW.some(k=>t===k)) return <mark key={i} style={{background:'rgba(255,215,64,.15)',color:'#ffd740',padding:'0 2px',borderRadius:'2px'}}>{p}</mark>;
    return p;
  });
}

const Spinner = ({s=16}:{s?:number}) => (
  <span style={{display:'inline-block',width:s,height:s,border:'2px solid #1a3050',borderTop:'2px solid #40c4ff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
);

// ── 공포탐욕 게이지 ─────────────────────────────────────────────────
const FGGauge: React.FC<{data:{value:number;label:string}|null}> = ({data}) => {
  if(!data) return <Spinner s={24}/>;
  const v=Math.max(0,Math.min(100,data.value));
  const zones=[{c:'#ff1744',max:20},{c:'#ff6d00',max:40},{c:'#ffd740',max:60},{c:'#b2ff59',max:80},{c:'#00e676',max:100}];
  const zone=zones.find(z=>v<=z.max)??zones[4];
  const rad=((v/100)*180-90)*Math.PI/180;
  const cx=90,cy=80,r=62;
  const LABEL:Record<string,string>={'Extreme Fear':'극도의 공포','Fear':'공포','Neutral':'중립','Greed':'탐욕','Extreme Greed':'극도의 탐욕'};
  return (
    <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
      <svg width={180} height={100} viewBox="0 0 180 100">
        {zones.map((z,i)=>{
          const a0=(i/zones.length)*Math.PI,a1=((i+1)/zones.length)*Math.PI,r1=62,r2=44;
          const p=(a:number)=>([cx-r1*Math.cos(a),cy-r1*Math.sin(a),cx-r2*Math.cos(a),cy-r2*Math.sin(a)]);
          const [x1,y1,x2,y2]=p(a0),[x4,y4,x3,y3]=p(a1);
          return <path key={i} d={`M${x1} ${y1} A${r1} ${r1} 0 0 1 ${x4} ${y4} L${x3} ${y3} A${r2} ${r2} 0 0 0 ${x2} ${y2}Z`} fill={z.c} opacity={.4}/>;
        })}
        <line x1={cx} y1={cy} x2={cx+r*Math.sin(rad)} y2={cy-r*Math.cos(rad)} stroke={zone.c} strokeWidth="3" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={6} fill={zone.c}/>
        <text x={cx} y={cy-16} textAnchor="middle" fill={zone.c} fontSize="22" fontWeight="bold">{v}</text>
      </svg>
      <div>
        <div style={{fontSize:'18px',fontWeight:'bold',color:zone.c,marginBottom:'4px'}}>{LABEL[data.label]??data.label}</div>
        <div style={{fontSize:'12px',color:'#546e7a'}}>공포&탐욕 지수</div>
        <div style={{fontSize:'11px',color:'#37474f',marginTop:'2px'}}>Alternative.me</div>
      </div>
    </div>
  );
};

// ── 지수 카드 (모바일) ───────────────────────────────────────────────
const IdxCard: React.FC<{meta:typeof IDX_META[0];q:Quote|undefined}> = ({meta,q}) => {
  const c=clr(q?.changePct??0);
  const pct52=q&&q.high52w&&q.low52w&&q.high52w!==q.low52w?((q.price-q.low52w)/(q.high52w-q.low52w))*100:null;
  const zone=pct52==null?null:pct52<20?{t:'🟢 기회',c:'#00e676'}:pct52>80?{t:'🔴 고점',c:'#ff5252'}:pct52>60?{t:'🟡 주의',c:'#ffd740'}:{t:'🔵 중간',c:'#546e7a'};
  return (
    <div style={{background:'#0d1b2e',border:`1px solid ${c}33`,borderLeft:`3px solid ${c}`,borderRadius:'10px',padding:'12px 14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
        <div>
          <div style={{fontSize:'11px',color:'#546e7a',letterSpacing:'1px'}}>{meta.sym}</div>
          <div style={{fontSize:'13px',color:'#90a4ae',marginTop:'1px'}}>{meta.name}</div>
        </div>
        {zone&&<span style={{fontSize:'11px',color:zone.c}}>{zone.t}</span>}
      </div>
      {!q
        ? <div style={{color:'#37474f',fontSize:'12px'}}>—</div>
        : <>
            <div style={{fontSize:'22px',fontWeight:'700',color:'#eceff1',marginBottom:'6px'}}>{fmt(q.price)}</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{background:bg(q.changePct),color:c,padding:'3px 10px',borderRadius:'5px',fontSize:'13px',fontWeight:'600'}}>
                {q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%
              </span>
              <span style={{fontSize:'12px',color:'#546e7a'}}>{q.change>=0?'+':''}{fmt(q.change)}</span>
            </div>
            {pct52!=null&&(
              <div style={{marginTop:'8px'}}>
                <div style={{background:'#1a2535',height:'4px',borderRadius:'2px'}}>
                  <div style={{height:'100%',width:`${Math.min(100,Math.max(0,pct52))}%`,background:pct52<20?'#00e676':pct52>80?'#ff5252':'#40c4ff',borderRadius:'2px'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',color:'#37474f',marginTop:'3px'}}>
                  <span>52W 저점</span><span>52W 고점</span>
                </div>
              </div>
            )}
          </>
      }
    </div>
  );
};

// ── 구글 캘린더 (모바일) ─────────────────────────────────────────────
const MobileCalendar: React.FC<{events:typeof CALENDAR;today:string}> = ({events,today}) => {
  const td=new Date(today+'T00:00:00');
  const [yr,setYr]=useState(td.getFullYear());
  const [mo,setMo]=useState(td.getMonth());
  const [sel,setSel]=useState<typeof CALENDAR[0]|null>(null);

  const prev=()=>{ if(mo===0){setYr(y=>y-1);setMo(11);}else setMo(m=>m-1); };
  const next=()=>{ if(mo===11){setYr(y=>y+1);setMo(0);}else setMo(m=>m+1); };
  const goT =()=>{ setYr(td.getFullYear()); setMo(td.getMonth()); };

  const dim=new Date(yr,mo+1,0).getDate();
  const fdow=new Date(yr,mo,1).getDay();
  const weeks:(number|null)[][]=[];
  let row:(number|null)[]=Array(fdow).fill(null);
  for(let d=1;d<=dim;d++){
    row.push(d);
    if(row.length===7){weeks.push(row);row=[];}
  }
  if(row.length>0){while(row.length<7)row.push(null);weeks.push(row);}

  return (
    <div>
      {/* 네비게이션 */}
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',padding:'0 2px'}}>
        <button onClick={prev} style={{background:'#1a2535',border:'none',color:'#90a4ae',cursor:'pointer',width:'36px',height:'36px',borderRadius:'50%',fontSize:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
        <span style={{fontSize:'18px',fontWeight:'700',color:'#eceff1',flex:1}}>{yr}년 {MONTHS_KO[mo]}</span>
        <button onClick={goT} style={{background:'#1a2535',border:'1px solid #40c4ff44',color:'#40c4ff',cursor:'pointer',padding:'6px 14px',borderRadius:'8px',fontSize:'13px'}}>오늘</button>
        <button onClick={next} style={{background:'#1a2535',border:'none',color:'#90a4ae',cursor:'pointer',width:'36px',height:'36px',borderRadius:'50%',fontSize:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
      </div>
      {/* 요일 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'4px'}}>
        {DAYS_KO.map((d,i)=>(
          <div key={d} style={{textAlign:'center',fontSize:'12px',fontWeight:'600',padding:'6px 0',
            color:i===0?'#ff5252':i===6?'#5c9eff':'#546e7a'}}>{d}</div>
        ))}
      </div>
      {/* 그리드 */}
      <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
        {weeks.map((wk,wi)=>(
          <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>
            {wk.map((day,di)=>{
              if(!day) return <div key={di} style={{minHeight:'64px',background:'rgba(6,13,26,.5)',borderRadius:'6px'}}/>;
              const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isT=ds===today, isPast=ds<today;
              const dayEvs=events.filter(e=>e.date===ds);
              return (
                <div key={di} style={{minHeight:'64px',background:isT?'rgba(64,196,255,.1)':isPast?'rgba(10,22,40,.5)':'#0d1b2e',borderRadius:'6px',padding:'4px',border:isT?'1px solid #40c4ff77':'1px solid #1a2535'}}>
                  <div style={{width:'26px',height:'26px',borderRadius:'50%',background:isT?'#40c4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'3px',fontSize:'13px',fontWeight:isT?'700':'400',color:isT?'#060d1a':di===0?'#ff5252':di===6?'#5c9eff':isPast?'#37474f':'#90a4ae'}}>{day}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    {dayEvs.map(ev=>{
                      const ec=EVT_COLOR[ev.type]??'#546e7a';
                      return (
                        <div key={ev.id} onClick={()=>setSel(sel?.id===ev.id?null:ev)}
                          style={{background:ec+'25',borderLeft:`2px solid ${ec}`,borderRadius:'2px',padding:'2px 3px',fontSize:'9px',color:ec,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',cursor:'pointer'}}>
                          {ev.title}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* 선택 이벤트 상세 */}
      {sel&&(
        <div style={{marginTop:'14px',background:'#060d1a',borderRadius:'12px',padding:'16px',border:`1px solid ${EVT_COLOR[sel.type]??'#1a2535'}55`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <span style={{fontSize:'11px',padding:'3px 8px',borderRadius:'4px',background:(EVT_COLOR[sel.type]??'#546e7a')+'22',color:EVT_COLOR[sel.type]??'#546e7a',border:`1px solid ${EVT_COLOR[sel.type]??'#546e7a'}44`}}>{EVT_LABEL[sel.type]??sel.type}</span>
              <span style={{fontSize:'12px',color:'#546e7a'}}>{sel.date}</span>
            </div>
            <button onClick={()=>setSel(null)} style={{background:'none',border:'none',color:'#546e7a',cursor:'pointer',fontSize:'20px',padding:'0 4px'}}>×</button>
          </div>
          <div style={{fontSize:'16px',color:'#eceff1',fontWeight:'700',marginBottom:'6px'}}>{sel.title}</div>
          {sel.desc&&<div style={{fontSize:'13px',color:'#90a4ae'}}>{sel.desc}</div>}
        </div>
      )}
      {/* 범례 */}
      <div style={{display:'flex',gap:'12px',marginTop:'14px',flexWrap:'wrap'}}>
        {Object.entries(EVT_COLOR).map(([k,c])=>(
          <span key={k} style={{fontSize:'11px',color:'#546e7a'}}><span style={{color:c}}>■</span> {EVT_LABEL[k]}</span>
        ))}
      </div>
    </div>
  );
};

// ── TradingView ──────────────────────────────────────────────────────
const TVChart: React.FC<{sym:string}> = ({sym}) => {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    ref.current.innerHTML='';
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async=true;
    s.innerHTML=JSON.stringify({symbol:sym,interval:'D',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',backgroundColor:'#060d1a',gridColor:'rgba(30,50,80,0.3)',width:'100%',height:340,studies:['RSI@tv-basicstudies']});
    ref.current.appendChild(s);
    return ()=>{if(ref.current)ref.current.innerHTML='';};
  },[sym]);
  return <div ref={ref} style={{width:'100%',height:340}}/>;
};

// ════════════════════════════════════════════════
// MAIN MOBILE DASHBOARD
// ════════════════════════════════════════════════
type TabKey = 'home'|'news'|'analysis'|'calendar'|'chart';

const TABS: {key:TabKey;icon:string;label:string}[] = [
  {key:'home',    icon:'📊', label:'시장'},
  {key:'news',    icon:'📰', label:'뉴스'},
  {key:'analysis',icon:'🧭', label:'분석'},
  {key:'calendar',icon:'📅', label:'캘린더'},
  {key:'chart',   icon:'📈', label:'차트'},
];
const CHARTS=[['NASDAQ:NVDA','엔비디아'],['NASDAQ:MSFT','마소'],['NYSE:LMT','록히드'],['KRX:005930','삼성'],['KRX:000660','하이닉스'],['BINANCE:BTCUSDT','BTC'],['TVC:GOLD','금'],['INDEX:SPX','S&P500']];
const NEWS_FILTERS=[['all','전체'],['trump','🎭 트럼프'],['macro','🌐 매크로'],['tech','💻 테크'],['crypto','₿ 코인'],['korea','🇰🇷 한국'],['energy','⛽ 에너지']];

export default function MobileDashboard() {
  const [tab,setTab]     = useState<TabKey>('home');
  const [mdata,setMdata] = useState<MarketData|null>(null);
  const [cryptoRT,setCR] = useState<any[]>([]);
  const [forexRT,setFR]  = useState<Record<string,number>>({});
  const [loading,setLoad]= useState(true);
  const [stale,setStale] = useState(false);
  const [nf,setNF]       = useState('all');
  const [chartSym,setCS] = useState('NASDAQ:NVDA');
  const [nowT,setNow]    = useState(new Date());

  const loadStatic=useCallback(async()=>{
    try {
      const r=await fetch(`${DATA_URL}?t=${Date.now()}`);
      if(!r.ok) throw new Error(`${r.status}`);
      const d:MarketData=await r.json();
      if(!d.updatedAt) return;
      setMdata(d);
      setLoad(false);
      const age=(Date.now()-new Date(d.updatedAt).getTime())/60000;
      setStale(age>15);
    } catch { setLoad(false); }
  },[]);

  const loadRT=useCallback(async()=>{
    try {
      const cr=await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,binancecoin&order=market_cap_desc&price_change_percentage=24h');
      if(cr.ok) setCR(await cr.json());
    } catch {}
    try {
      const fx=await fetch('https://open.er-api.com/v6/latest/USD');
      if(fx.ok){const d=await fx.json();setFR(d.rates??{});}
    } catch {}
  },[]);

  useEffect(()=>{
    setInterval(()=>setNow(new Date()),1000);
    loadStatic(); loadRT();
    setInterval(loadStatic,60_000);
    setInterval(loadRT,60_000);
  },[]);

  const quotes=mdata?.quotes??{};
  const crypto=cryptoRT.length?cryptoRT:(mdata?.crypto??[]);
  const rawRates=Object.keys(forexRT).length?forexRT:(mdata?.forex??{});
  const fg=mdata?.fearGreed??null;
  const news=mdata?.news??[];
  const today=new Date().toISOString().split('T')[0];
  const usdKrw=rawRates.KRW??0;
  const updTime=mdata?.updatedAt?new Date(mdata.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):null;

  // 시장 분석 계산
  const fgVal=fg?.value??50;
  const sectorPerf=SECTOR_DEF.map(s=>({...s,pct:quotes[s.yf]?.changePct??0,ok:!!quotes[s.yf]})).filter(s=>s.ok).sort((a,b)=>b.pct-a.pct);
  const positions=IDX_META.map(m=>{const q=quotes[m.yf];if(!q||!q.high52w||!q.low52w||q.high52w===q.low52w)return null;return((q.price-q.low52w)/(q.high52w-q.low52w))*100;}).filter((v):v is number=>v!=null);
  const avgPos=positions.length?positions.reduce((a,b)=>a+b,0)/positions.length:50;

  let phase='',phaseColor='',strategy='';
  if(fgVal<25&&avgPos<35){phase='극단적 공포 — 매수 타이밍';phaseColor='#00e676';strategy='분할매수 시작 권장 (SPY·QQQ)';}
  else if(fgVal<40){phase='공포 구간 — 방어적 관망';phaseColor='#ffd740';strategy='헤지 자산 비중 유지 (GLD·ITA)';}
  else if(fgVal>75&&avgPos>70){phase='과열 경계 — 익절 고려';phaseColor='#ff5252';strategy='차익 실현 및 현금 비중 확대';}
  else if(fgVal>60){phase='상승 추세 — 모멘텀 추종';phaseColor='#00e676';strategy='성장 ETF 비중 확대 (QQQ·SOXX)';}
  else{phase='중립 — 선별적 접근';phaseColor='#90a4ae';strategy='섹터 로테이션 주시, 분산 유지';}

  const recEtfs=ETF_DB.filter(e=>fgVal>=e.fgRange[0]&&fgVal<=e.fgRange[1]).slice(0,4);
  const filteredNews=nf==='all'?news:nf==='trump'?news.filter((n:any)=>n.isTrump):news.filter((n:any)=>n.category===nf);

  const forexList=[
    {pair:'USD/KRW',flag:'🇺🇸',r:usdKrw},
    {pair:'EUR/KRW',flag:'🇪🇺',r:usdKrw&&rawRates.EUR?usdKrw/rawRates.EUR:0},
    {pair:'JPY/KRW',flag:'🇯🇵',r:usdKrw&&rawRates.JPY?(usdKrw/rawRates.JPY)*100:0},
    {pair:'CNY/KRW',flag:'🇨🇳',r:usdKrw&&rawRates.CNY?usdKrw/rawRates.CNY:0},
    {pair:'GBP/KRW',flag:'🇬🇧',r:usdKrw&&rawRates.GBP?usdKrw/rawRates.GBP:0},
  ];

  // ── 탭별 콘텐츠 ────────────────────────────────────────────────────

  const HomeTab = () => (
    <div style={{padding:'12px'}}>
      {/* FG 게이지 */}
      <div style={{background:'#0d1b2e',borderRadius:'12px',padding:'14px',marginBottom:'12px',border:'1px solid #1a3050'}}>
        <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>🧠 공포&탐욕 지수</div>
        <FGGauge data={fg}/>
      </div>

      {/* 지수 2열 그리드 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>📊 주요 지수</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
        {IDX_META.map(m=><IdxCard key={m.yf} meta={m} q={quotes[m.yf]}/>)}
      </div>

      {/* 원자재 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>🪙 원자재 선물</div>
      <div style={{background:'#0d1b2e',borderRadius:'12px',padding:'12px',marginBottom:'12px',border:'1px solid #1a3050'}}>
        {COM_META.map((m,i)=>{
          const q=quotes[m.yf];
          return (
            <div key={m.sym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<COM_META.length-1?'1px solid #1a2535':'none'}}>
              <div>
                <span style={{fontSize:'16px',marginRight:'8px'}}>{m.icon}</span>
                <span style={{fontSize:'14px',color:'#eceff1',fontWeight:'600'}}>{m.name}</span>
                <div style={{fontSize:'11px',color:'#37474f',marginLeft:'26px'}}>{m.unit}</div>
              </div>
              {!q?<Spinner/>:<div style={{textAlign:'right'}}>
                <div style={{fontSize:'15px',color:'#f1f5f9',fontWeight:'700'}}>${fmt(q.price,['NG=F','HG=F'].includes(m.yf)?3:2)}</div>
                <div style={{fontSize:'12px',color:clr(q.changePct),fontWeight:'600'}}>{q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%</div>
              </div>}
            </div>
          );
        })}
      </div>

      {/* 암호화폐 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>₿ 암호화폐 <span style={{color:'#00e676',fontSize:'10px'}}>● CoinGecko</span></div>
      <div style={{background:'#0d1b2e',borderRadius:'12px',padding:'12px',marginBottom:'12px',border:'1px solid #1a3050'}}>
        {crypto.length===0&&<div style={{textAlign:'center',padding:'20px'}}><Spinner s={24}/></div>}
        {crypto.map((c:any,i:number)=>(
          <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<crypto.length-1?'1px solid #1a2535':'none'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#1a2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',color:'#ffd740',fontWeight:'700'}}>{c.symbol.toUpperCase().slice(0,2)}</div>
              <div>
                <div style={{fontSize:'14px',color:'#eceff1',fontWeight:'600'}}>{c.name}</div>
                <div style={{fontSize:'11px',color:'#37474f'}}>{fmtC(c.market_cap)}</div>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:'15px',color:'#f1f5f9',fontWeight:'700'}}>${c.current_price.toLocaleString()}</div>
              <div style={{fontSize:'13px',color:clr(c.price_change_percentage_24h),fontWeight:'600'}}>{c.price_change_percentage_24h>=0?'▲':'▼'} {Math.abs(c.price_change_percentage_24h).toFixed(2)}%</div>
            </div>
          </div>
        ))}
      </div>

      {/* 환율 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>💱 환율 <span style={{color:'#00e676',fontSize:'10px'}}>● Open ER API</span></div>
      <div style={{background:'#0d1b2e',borderRadius:'12px',padding:'12px',marginBottom:'12px',border:'1px solid #1a3050'}}>
        {usdKrw===0&&<div style={{textAlign:'center',padding:'20px'}}><Spinner s={24}/></div>}
        {usdKrw>0&&forexList.map((fx,i)=>(
          <div key={fx.pair} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<forexList.length-1?'1px solid #1a2535':'none'}}>
            <span style={{fontSize:'14px',color:'#eceff1'}}>{fx.flag} {fx.pair}</span>
            <span style={{fontSize:'16px',fontWeight:'700',color:'#f1f5f9'}}>₩{fmt(fx.r,1)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const NewsTab = () => (
    <div style={{padding:'12px'}}>
      {/* 필터 칩 (수평 스크롤) */}
      <div style={{display:'flex',gap:'8px',overflowX:'auto',marginBottom:'12px',paddingBottom:'4px',scrollbarWidth:'none'}}>
        {NEWS_FILTERS.map(([k,l])=>(
          <button key={k} onClick={()=>setNF(k)} style={{
            flexShrink:0,padding:'8px 14px',borderRadius:'20px',
            border:`1px solid ${nf===k?'#40c4ff':'#1a2535'}`,
            background:nf===k?'#40c4ff22':'#0d1b2e',
            color:nf===k?'#40c4ff':'#90a4ae',
            cursor:'pointer',fontSize:'13px',whiteSpace:'nowrap',
          }}>{l}</button>
        ))}
      </div>
      <div style={{fontSize:'11px',color:news.length?'#00e676':'#546e7a',marginBottom:'10px'}}>
        {news.length?`● ${filteredNews.length}건 표시 중`:'GitHub Actions 데이터 대기 중...'}
      </div>
      {filteredNews.length===0&&(
        <div style={{textAlign:'center',color:'#37474f',padding:'60px 20px',fontSize:'14px'}}>뉴스 없음</div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        {filteredNews.map((item:any)=>{
          const SC={positive:'#00e676',negative:'#ff5252',neutral:'#ffd740'} as const;
          const SI={positive:'↑ 호재',negative:'↓ 악재',neutral:'→ 중립'} as const;
          return (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
              <div style={{background:item.isTrump?'rgba(255,82,82,.05)':'#0d1b2e',border:`1px solid ${item.isTrump?'rgba(255,82,82,.2)':'#1a2535'}`,borderRadius:'12px',padding:'14px'}}>
                <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'8px',flexWrap:'wrap'}}>
                  {item.isTrump&&<span style={{fontSize:'10px',background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'2px 7px',borderRadius:'10px',border:'1px solid rgba(255,82,82,.3)'}}>🎭 트럼프</span>}
                  <span style={{fontSize:'10px',color:SC[item.sentiment as keyof typeof SC],background:SC[item.sentiment as keyof typeof SC]+'22',padding:'2px 7px',borderRadius:'10px'}}>{SI[item.sentiment as keyof typeof SI]}</span>
                  <span style={{fontSize:'10px',color:'#37474f',marginLeft:'auto'}}>{item.source} · {item.time}</span>
                </div>
                <div style={{fontSize:'14px',color:'#cfd8dc',lineHeight:'1.6'}}>{highlight(item.title)}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );

  const AnalysisTab = () => (
    <div style={{padding:'12px'}}>
      {/* 시장 국면 */}
      <div style={{background:'#0d1b2e',borderRadius:'12px',padding:'16px',marginBottom:'12px',border:`1px solid ${phaseColor}33`}}>
        <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>🧭 현재 시장 국면</div>
        <div style={{fontSize:'17px',fontWeight:'700',color:phaseColor,marginBottom:'10px'}}>{phase}</div>
        <div style={{display:'flex',gap:'20px',marginBottom:'12px'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'28px',fontWeight:'700',color:fgVal<40?'#ff5252':fgVal>60?'#00e676':'#ffd740'}}>{fgVal}</div>
            <div style={{fontSize:'11px',color:'#546e7a'}}>공포&탐욕</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'28px',fontWeight:'700',color:avgPos<30?'#00e676':avgPos>70?'#ff5252':'#40c4ff'}}>{avgPos.toFixed(0)}%</div>
            <div style={{fontSize:'11px',color:'#546e7a'}}>52주 평균</div>
          </div>
        </div>
        <div style={{background:phaseColor+'12',borderLeft:`3px solid ${phaseColor}`,padding:'10px 12px',borderRadius:'6px',fontSize:'13px',color:phaseColor,lineHeight:'1.5'}}>
          💡 {strategy}
        </div>
      </div>

      {/* 섹터 순위 */}
      <div style={{background:'#0d1b2e',borderRadius:'12px',padding:'16px',marginBottom:'12px',border:'1px solid #1a3050'}}>
        <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>🔥 섹터 성과 순위</div>
        {sectorPerf.length===0?<div style={{color:'#37474f',fontSize:'13px'}}>로딩 중...</div>:
          sectorPerf.map((s,i)=>(
            <div key={s.yf} style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
              <div style={{fontSize:'13px',color:'#546e7a',width:'16px',textAlign:'right',flexShrink:0}}>{i+1}</div>
              <div style={{fontSize:'18px',flexShrink:0}}>{s.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'14px',color:'#eceff1',fontWeight:'600'}}>{s.name}</span>
                  <span style={{fontSize:'14px',fontWeight:'700',color:clr(s.pct)}}>{s.pct>=0?'+':''}{s.pct.toFixed(2)}%</span>
                </div>
                <div style={{height:'5px',background:'#1a2535',borderRadius:'3px'}}>
                  <div style={{height:'100%',width:`${Math.min(100,Math.abs(s.pct)*20+10)}%`,background:clr(s.pct),borderRadius:'3px'}}/>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* 섹터 종목 상세 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>📋 섹터별 종목</div>
      {SECTOR_DEF.map(def=>{
        const etfQ=quotes[def.yf];
        return (
          <div key={def.yf} style={{background:'#0d1b2e',borderRadius:'12px',padding:'14px',marginBottom:'8px',border:'1px solid #1a3050'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'18px'}}>{def.icon}</span>
                <div>
                  <div style={{fontSize:'15px',fontWeight:'700',color:'#eceff1'}}>{def.name}</div>
                  <div style={{fontSize:'11px',color:'#37474f'}}>{def.yf} ETF</div>
                </div>
              </div>
              <span style={{color:clr(etfQ?.changePct??0),fontWeight:'700',fontSize:'15px'}}>{etfQ?(etfQ.changePct>=0?'+':'')+etfQ.changePct.toFixed(2)+'%':'—'}</span>
            </div>
            {def.stocks.map(sym=>{
              const q=quotes[sym]; const c=clr(q?.changePct??0);
              return (
                <div key={sym} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 0',borderTop:'1px solid #1a2535'}}>
                  <span style={{fontSize:'11px',color:'#546e7a',width:'44px',flexShrink:0}}>{sym.replace('.KS','')}</span>
                  <span style={{fontSize:'13px',color:'#b0bec5',flex:1}}>{STOCK_NAME[sym]??sym}</span>
                  {!q?<Spinner/>:<span style={{color:c,fontSize:'14px',fontWeight:'700',flexShrink:0}}>{q.changePct>=0?'+':''}{q.changePct.toFixed(2)}%</span>}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* ETF 추천 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px',marginTop:'4px'}}>💼 추천 ETF</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'8px'}}>
        {recEtfs.map((e,i)=>(
          <div key={e.sym} style={{background:'#0d1b2e',borderRadius:'12px',padding:'14px',border:`1px solid ${e.color}33`,position:'relative'}}>
            {i===0&&<div style={{position:'absolute',top:'10px',right:'10px',fontSize:'9px',background:'#ffd740',color:'#060d1a',borderRadius:'4px',padding:'2px 6px',fontWeight:'700'}}>TOP</div>}
            <div style={{background:e.color+'22',color:e.color,fontSize:'10px',padding:'3px 8px',borderRadius:'10px',display:'inline-block',marginBottom:'8px',fontWeight:'600'}}>{e.tag}</div>
            <div style={{fontSize:'18px',fontWeight:'700',color:e.color,marginBottom:'3px'}}>{e.sym}</div>
            <div style={{fontSize:'13px',color:'#90a4ae',marginBottom:'4px'}}>{e.name}</div>
            <div style={{fontSize:'11px',color:'#546e7a',lineHeight:'1.4'}}>{e.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const CalendarTab = () => (
    <div style={{padding:'12px'}}>
      <MobileCalendar events={CALENDAR} today={today}/>
      {/* 다가오는 일정 리스트 */}
      <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',margin:'16px 0 10px'}}>📌 다가오는 이벤트</div>
      {CALENDAR.filter(e=>e.date>=today).map(ev=>{
        const ec=EVT_COLOR[ev.type]??'#546e7a';
        const d=new Date(ev.date+'T00:00:00');
        const diffDays=Math.ceil((d.getTime()-new Date(today+'T00:00:00').getTime())/(1000*60*60*24));
        return (
          <div key={ev.id} style={{background:'#0d1b2e',borderRadius:'12px',padding:'14px',marginBottom:'8px',border:`1px solid ${ec}33`,display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <div style={{background:ec+'22',borderRadius:'10px',padding:'8px 10px',textAlign:'center',flexShrink:0,minWidth:'44px'}}>
              <div style={{fontSize:'11px',color:ec,fontWeight:'600'}}>{d.getMonth()+1}월</div>
              <div style={{fontSize:'20px',fontWeight:'700',color:ec,lineHeight:1}}>{d.getDate()}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'5px'}}>
                <span style={{fontSize:'10px',padding:'2px 7px',borderRadius:'8px',background:ec+'22',color:ec,border:`1px solid ${ec}44`}}>{EVT_LABEL[ev.type]??ev.type}</span>
                <span style={{fontSize:'11px',color:'#37474f'}}>{diffDays===0?'오늘':diffDays===1?'내일':`D-${diffDays}`}</span>
                {ev.imp==='high'&&<span style={{fontSize:'10px',color:'#ff5252'}}>●●●</span>}
              </div>
              <div style={{fontSize:'15px',color:'#eceff1',fontWeight:'600',marginBottom:'3px'}}>{ev.title}</div>
              {ev.desc&&<div style={{fontSize:'12px',color:'#546e7a'}}>{ev.desc}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const ChartTab = () => (
    <div style={{padding:'12px'}}>
      {/* 차트 종목 선택 (수평 스크롤) */}
      <div style={{display:'flex',gap:'8px',overflowX:'auto',marginBottom:'12px',paddingBottom:'4px',scrollbarWidth:'none'}}>
        {CHARTS.map(([s,n])=>(
          <button key={s} onClick={()=>setCS(s)} style={{
            flexShrink:0,padding:'8px 14px',borderRadius:'20px',
            border:`1px solid ${chartSym===s?'#40c4ff':'#1a2535'}`,
            background:chartSym===s?'#40c4ff22':'#0d1b2e',
            color:chartSym===s?'#40c4ff':'#90a4ae',
            cursor:'pointer',fontSize:'13px',whiteSpace:'nowrap',
          }}>{n}</button>
        ))}
      </div>
      <div style={{background:'#0d1b2e',borderRadius:'12px',overflow:'hidden',border:'1px solid #1a3050'}}>
        <TVChart sym={chartSym}/>
      </div>
      <div style={{fontSize:'11px',color:'#37474f',textAlign:'center',marginTop:'8px'}}>
        RSI 지표 포함 · TradingView 제공
      </div>
    </div>
  );

  return (
    <div style={{background:'#060d1a',color:'#e0e6ed',fontFamily:"'Inter','Noto Sans KR',system-ui,sans-serif",minHeight:'100vh',maxWidth:'480px',margin:'0 auto',position:'relative'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{display:none}
        button{font-family:'Inter','Noto Sans KR',system-ui,sans-serif}
        a{-webkit-tap-highlight-color:transparent}
      `}</style>

      {/* 상단 헤더 (고정) */}
      <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:'linear-gradient(135deg,#07122a,#0d1f3f)',borderBottom:'1px solid #00d4ff22',padding:'10px 16px',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:'15px',fontWeight:'700',background:'linear-gradient(90deg,#00d4ff,#00e676)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>◆ MARKET TERMINAL</div>
          <div style={{fontSize:'10px',color:'#37474f'}}>10분 갱신{updTime&&` · ${updTime} 기준`}{stale&&' ⚠ 오래됨'}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:'18px',fontWeight:'700',color:'#40c4ff',fontVariantNumeric:'tabular-nums'}}>{nowT.toLocaleTimeString('ko-KR',{hour12:false})}</div>
          <div style={{fontSize:'10px',color:'#37474f'}}>{loading&&'로딩중...'}</div>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div style={{paddingTop:'60px',paddingBottom:'72px',minHeight:'100vh',overflowY:'auto'}}>
        {loading&&(
          <div style={{textAlign:'center',padding:'60px 20px'}}>
            <Spinner s={32}/>
            <div style={{color:'#546e7a',fontSize:'13px',marginTop:'12px'}}>시장 데이터 로딩 중...</div>
            <div style={{color:'#37474f',fontSize:'11px',marginTop:'6px'}}>GitHub Actions가 10분마다 업데이트합니다</div>
          </div>
        )}
        {!loading&&(
          <>
            {tab==='home'    &&<HomeTab/>}
            {tab==='news'    &&<NewsTab/>}
            {tab==='analysis'&&<AnalysisTab/>}
            {tab==='calendar'&&<CalendarTab/>}
            {tab==='chart'   &&<ChartTab/>}
          </>
        )}
      </div>

      {/* 하단 탭바 (고정) */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:'#07122a',borderTop:'1px solid #1a2535',display:'flex',zIndex:1000,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            flex:1,padding:'10px 4px 8px',background:'none',border:'none',
            cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',
            color:tab===t.key?'#40c4ff':'#546e7a',
            borderTop:tab===t.key?'2px solid #40c4ff':'2px solid transparent',
          }}>
            <span style={{fontSize:'20px',lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:'10px',fontWeight:tab===t.key?'700':'400'}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
