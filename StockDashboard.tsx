/**
 * Market Terminal
 * 데이터 흐름: GitHub Actions(10분) → market-data.json → 이 컴포넌트
 * CORS 문제 없음 — 동일 도메인 파일 읽기
 * 암호화폐·환율은 CoinGecko·Open ER API 직접 호출로 보완
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── 경로: GitHub Pages 에서 /stocks/market-data.json 로 서빙됨
const DATA_URL = './market-data.json';

// ── 심볼 메타 (화면 표시용)
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
  { yf:'GC=F', name:'금',      sym:'GOLD',   unit:'USD/oz',    icon:'🥇' },
  { yf:'SI=F', name:'은',      sym:'SILVER', unit:'USD/oz',    icon:'🥈' },
  { yf:'CL=F', name:'WTI원유', sym:'WTI',    unit:'USD/bbl',   icon:'🛢️' },
  { yf:'BZ=F', name:'브렌트유',sym:'BRENT',  unit:'USD/bbl',   icon:'⛽' },
  { yf:'NG=F', name:'천연가스',sym:'NG',     unit:'USD/MMBtu', icon:'🔥' },
  { yf:'HG=F', name:'구리',    sym:'CU',     unit:'USD/lb',    icon:'🔶' },
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
const TRUMP_KW = ['trump','트럼프','tariff','관세','trade war','무역전쟁','white house','백악관'];
const ALERT_KW = ['fed','연준','fomc','금리','cpi','inflation','crash','recession','war','전쟁'];
const CALENDAR = [
  { id:'1', date:'2026-04-02', title:'🚨 상호관세 발효 (해방의 날)', imp:'high', type:'geopolitical', desc:'전 세계 교역국 대상 상호관세', country:'US' },
  { id:'2', date:'2026-04-04', title:'🔴 美 고용보고서 (NFP)',       imp:'high', type:'economic',     desc:'3월 비농업 고용지표',         country:'US' },
  { id:'3', date:'2026-04-07', title:'FOMC 의사록',                  imp:'high', type:'fed',          desc:'',                            country:'US' },
  { id:'4', date:'2026-04-10', title:'🔴 美 CPI',                    imp:'high', type:'economic',     desc:'3월 소비자물가지수',           country:'US' },
  { id:'5', date:'2026-04-14', title:'🔴 JPMorgan 실적',             imp:'high', type:'earnings',     desc:'',                            country:'US' },
  { id:'6', date:'2026-04-14', title:'옵션 만기일',                  imp:'med',  type:'options',      desc:'',                            country:'US' },
  { id:'7', date:'2026-04-22', title:'🔴 TSMC 실적',                 imp:'high', type:'earnings',     desc:'',                            country:'TW' },
  { id:'8', date:'2026-04-23', title:'🔴 Tesla 실적',                imp:'high', type:'earnings',     desc:'',                            country:'US' },
  { id:'9', date:'2026-04-25', title:'🔴 FOMC 금리 결정',            imp:'high', type:'fed',          desc:'파월 기자회견',               country:'US' },
  { id:'10',date:'2026-04-30', title:'🔴 美 GDP 속보치 (1Q)',        imp:'high', type:'economic',     desc:'',                            country:'US' },
  { id:'11',date:'2026-04-30', title:'Microsoft 실적',               imp:'high', type:'earnings',     desc:'',                            country:'US' },
  { id:'12',date:'2026-05-01', title:'🔴 Apple 실적',                imp:'high', type:'earnings',     desc:'',                            country:'US' },
  { id:'13',date:'2026-05-02', title:'美 고용보고서 (4월)',           imp:'high', type:'economic',     desc:'',                            country:'US' },
];

// ── 유틸
const fmt = (n:number, d=2) => isNaN(n)||n===0 ? '—' : n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtCap = (n:number) => n>=1e12?`$${(n/1e12).toFixed(2)}T`:n>=1e9?`$${(n/1e9).toFixed(1)}B`:`$${(n/1e6).toFixed(0)}M`;
const clr = (v:number) => v>0?'#00e676':v<0?'#ff5252':'#90a4ae';
const bg  = (v:number) => v>0?'rgba(0,230,118,.12)':v<0?'rgba(255,82,82,.12)':'rgba(144,164,174,.1)';

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

function getMarketStatus() {
  const now=new Date(), u=now.getUTCHours()*60+now.getUTCMinutes(), d=now.getUTCDay(), wd=d>=1&&d<=5;
  const usO=wd&&u>=810&&u<1200, usP=wd&&u>=570&&u<810, usA=wd&&u>=1200&&u<1320;
  return {
    usStatus: usO?'개장중':usP?'프리마켓':usA?'시간외':'폐장',
    usColor:  usO?'#00e676':usP||usA?'#ffd740':'#ff5252',
    krStatus: wd&&u>=0&&u<390?'개장중':'폐장',
  };
}

interface Quote { price:number; change:number; changePct:number; high52w:number; low52w:number; name?:string; }
interface MarketData {
  updatedAt: string;
  quotes: Record<string,Quote>;
  crypto: any[];
  forex: Record<string,number>;
  fearGreed: { value:number; label:string };
  news: any[];
}

// ── 서브컴포넌트
const Spinner = ({s=14}:{s?:number}) => (
  <span style={{display:'inline-block',width:s,height:s,border:'2px solid #1a3050',borderTop:'2px solid #40c4ff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
);

const FGGauge: React.FC<{data:{value:number;label:string}|null}> = ({data}) => {
  if(!data) return <div style={{height:88,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner s={24}/></div>;
  const v=Math.max(0,Math.min(100,data.value));
  const zones=[{c:'#ff1744',max:20},{c:'#ff6d00',max:40},{c:'#ffd740',max:60},{c:'#b2ff59',max:80},{c:'#00e676',max:100}];
  const zone=zones.find(z=>v<=z.max)??zones[4];
  const rad=((v/100)*180-90)*Math.PI/180;
  const cx=75,cy=70,r=55;
  const LABEL: Record<string,string> = {'Extreme Fear':'극도의 공포','Fear':'공포','Neutral':'중립','Greed':'탐욕','Extreme Greed':'극도의 탐욕'};
  return (
    <div style={{textAlign:'center'}}>
      <svg width={150} height={88} viewBox="0 0 150 88">
        {zones.map((z,i)=>{
          const a0=(i/zones.length)*Math.PI,a1=((i+1)/zones.length)*Math.PI,r1=55,r2=38;
          const p=(a:number)=>([cx-r1*Math.cos(a),cy-r1*Math.sin(a),cx-r2*Math.cos(a),cy-r2*Math.sin(a)]);
          const [x1,y1,x2,y2]=p(a0),[x4,y4,x3,y3]=p(a1);
          return <path key={i} d={`M${x1} ${y1} A${r1} ${r1} 0 0 1 ${x4} ${y4} L${x3} ${y3} A${r2} ${r2} 0 0 0 ${x2} ${y2}Z`} fill={z.c} opacity={.35}/>;
        })}
        <line x1={cx} y1={cy} x2={cx+r*Math.sin(rad)} y2={cy-r*Math.cos(rad)} stroke={zone.c} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={5} fill={zone.c}/>
        <text x={cx} y={cy-14} textAnchor="middle" fill={zone.c} fontSize="18" fontWeight="bold">{v}</text>
      </svg>
      <div style={{color:zone.c,fontWeight:'bold',fontSize:'12px',marginTop:'-2px'}}>{LABEL[data.label]??data.label}</div>
      <div style={{color:'#546e7a',fontSize:'10px'}}>Alternative.me 공포&탐욕</div>
    </div>
  );
};

const Sparkline: React.FC<{data:number[];pos:boolean}> = ({data,pos}) => {
  if(data.length<2) return null;
  const mn=Math.min(...data),mx=Math.max(...data),rng=mx-mn||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*70},${28-((v-mn)/rng)*28}`).join(' ');
  return <svg width={70} height={28}><polyline fill="none" stroke={pos?'#00e676':'#ff5252'} strokeWidth="1.5" points={pts}/></svg>;
};

const IdxCard: React.FC<{meta:typeof IDX_META[0];q:Quote|undefined;spark:number[];loading:boolean}> = ({meta,q,spark,loading}) => {
  const pos=(q?.changePct??0)>=0, c=clr(q?.changePct??0);
  const pct52=q&&q.high52w&&q.low52w?((q.price-q.low52w)/(q.high52w-q.low52w))*100:null;
  const fromATH=q?((meta.ath-q.price)/meta.ath*100):null;
  const zone=pct52==null?'—':pct52<20?'🟢 기회구간':pct52>80?'🔴 고점권':pct52>60?'🟡 주의':'🔵 중간';
  return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderLeft:`3px solid ${c}`,borderRadius:'8px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
        <div>
          <div style={{fontSize:'10px',color:'#546e7a',letterSpacing:'1px'}}>{meta.sym}</div>
          <div style={{fontSize:'12px',color:'#90a4ae'}}>{meta.name}</div>
        </div>
        {spark.length>1&&<Sparkline data={spark} pos={pos}/>}
      </div>
      {loading?<div style={{padding:'10px'}}><Spinner s={20}/></div>:!q?
        <div style={{fontSize:'11px',color:'#546e7a',padding:'10px'}}>데이터 없음</div>:
        <>
          <div style={{fontSize:'20px',fontWeight:'bold',color:'#eceff1',marginBottom:'4px'}}>{fmt(q.price)}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{background:bg(q.changePct),color:c,padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'bold'}}>
              {pos?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%
            </span>
            <span style={{fontSize:'10px',color:'#546e7a'}}>{q.change>=0?'+':''}{fmt(q.change)}</span>
          </div>
          {pct52!=null&&q.high52w>0&&(
            <div>
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
        </>
      }
    </div>
  );
};

function sigColor(pct:number) { return pct>3?'#00e676':pct<-3?'#ff5252':pct<0?'#ffd740':'#40c4ff'; }
function sigLabel(pct:number) { return pct>3?'매수':pct<-3?'매도':pct<0?'보유':'관망'; }

const SectorCard: React.FC<{def:typeof SECTOR_DEF[0];quotes:Record<string,Quote>;loading:boolean}> = ({def,quotes,loading}) => {
  const eq=quotes[def.yf], pct=eq?.changePct??0;
  return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
        <div>
          <span style={{fontSize:'15px'}}>{def.icon}</span>
          <span style={{fontWeight:'bold',color:'#eceff1',fontSize:'13px',marginLeft:'6px'}}>{def.name}</span>
          <span style={{color:'#37474f',fontSize:'10px',marginLeft:'6px'}}>{def.yf} ETF</span>
        </div>
        {loading?<Spinner/>:<span style={{color:clr(pct),fontWeight:'bold',fontSize:'13px'}}>{pct>=0?'+':''}{pct.toFixed(2)}%</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}>
        {def.stocks.map(sym=>{
          const q=quotes[sym]; const sc=q?sigColor(q.changePct):'#40c4ff'; const sl=q?sigLabel(q.changePct):'관망';
          return (
            <div key={sym} style={{background:'#0a1628',borderRadius:'6px',padding:'5px 8px',display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${sc}22`}}>
              <div>
                <div style={{fontSize:'10px',color:'#546e7a'}}>{sym.replace('.KS','')}</div>
                <div style={{fontSize:'11px',color:'#b0bec5'}}>{STOCK_NAME[sym]??sym}</div>
              </div>
              <div style={{textAlign:'right'}}>
                {loading||!q?<Spinner/>:<>
                  <div style={{color:clr(q.changePct),fontSize:'11px',fontWeight:'bold'}}>{q.changePct>=0?'+':''}{q.changePct.toFixed(2)}%</div>
                  <div style={{background:sc+'22',color:sc,fontSize:'9px',padding:'1px 5px',borderRadius:'3px'}}>{sl}</div>
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
const ImpC={high:'#ff5252',med:'#ffd740',low:'#00e676'} as const;

const CalItem: React.FC<{ev:typeof CALENDAR[0];today:string}> = ({ev,today}) => {
  const isT=ev.date===today, d=new Date(ev.date);
  const tc=ETC[ev.type as keyof typeof ETC]??'#546e7a';
  const ic=ImpC[ev.imp as keyof typeof ImpC]??'#546e7a';
  return (
    <div style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'7px 8px',borderRadius:'6px',marginBottom:'3px',background:isT?'#0a1f3d':'transparent',border:isT?'1px solid #40c4ff44':'1px solid transparent'}}>
      <div style={{minWidth:'34px',textAlign:'center',background:isT?'#40c4ff22':'#1a2535',borderRadius:'6px',padding:'3px'}}>
        <div style={{fontSize:'9px',color:'#546e7a'}}>{d.getMonth()+1}월</div>
        <div style={{fontSize:'16px',fontWeight:'bold',lineHeight:1,color:isT?'#40c4ff':'#eceff1'}}>{d.getDate()}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'3px',flexWrap:'wrap'}}>
          <span style={{fontSize:'9px',padding:'1px 5px',borderRadius:'3px',background:tc+'22',color:tc,border:`1px solid ${tc}44`}}>{ETL[ev.type as keyof typeof ETL]??ev.type}</span>
          <span style={{fontSize:'9px',color:ic}}>{'●'.repeat(ev.imp==='high'?3:ev.imp==='med'?2:1)}</span>
          <span style={{fontSize:'9px',color:'#37474f'}}>{ev.country}</span>
        </div>
        <div style={{fontSize:'12px',color:'#cfd8dc',fontWeight:ev.imp==='high'?'bold':'normal'}}>{ev.title}</div>
        {ev.desc&&<div style={{fontSize:'10px',color:'#37474f',marginTop:'2px'}}>{ev.desc}</div>}
      </div>
    </div>
  );
};

const TVChart: React.FC<{sym:string;h?:number}> = ({sym,h=420}) => {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    ref.current.innerHTML='';
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async=true;
    s.innerHTML=JSON.stringify({symbol:sym,interval:'D',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',backgroundColor:'#0d1b2e',gridColor:'rgba(30,50,80,0.3)',width:'100%',height:h,studies:['RSI@tv-basicstudies','MACD@tv-basicstudies']});
    ref.current.appendChild(s);
    return ()=>{if(ref.current)ref.current.innerHTML='';};
  },[sym]);
  return <div ref={ref} style={{width:'100%',height:h}}/>;
};

// ════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════
export default function StockDashboard() {
  const [nowT,setNow]     = useState(new Date());
  const [mdata,setMdata]  = useState<MarketData|null>(null);
  const [cryptoRT,setCR]  = useState<any[]>([]);   // CoinGecko 실시간 보완
  const [forexRT,setFR]   = useState<Record<string,number>>({});
  const [sparks,setSparks]= useState<Record<string,number[]>>({});
  const [loading,setLoad] = useState(true);
  const [stale,setStale]  = useState(false);
  const [tab,setTab]      = useState<'news'|'cal'|'chart'>('news');
  const [nf,setNF]        = useState('all');
  const [chartSym,setCS]  = useState('NASDAQ:NVDA');
  const [alerts,setAlerts]= useState<{id:number;text:string;type:string}[]>([]);

  const addAlert=(text:string,type:string)=>{
    const id=Date.now();
    setAlerts(p=>[{id,text,type},...p].slice(0,4));
    setTimeout(()=>setAlerts(p=>p.filter(a=>a.id!==id)),9000);
  };

  // market-data.json 로드 (GitHub Actions 가 갱신한 파일)
  const loadStatic = useCallback(async()=>{
    try {
      const r=await fetch(`${DATA_URL}?t=${Date.now()}`);
      if(!r.ok) throw new Error(`${r.status}`);
      const d:MarketData=await r.json();
      if(!d.updatedAt) return;   // 초기 빈 파일

      setMdata(d);
      setLoad(false);

      // 스파크라인 업데이트
      setSparks(prev=>{
        const n={...prev};
        Object.entries(d.quotes).forEach(([k,q])=>{ n[k]=[...(n[k]??[]).slice(-23),q.price]; });
        return n;
      });

      // 오래된 데이터 경고 (15분 초과)
      const age=(Date.now()-new Date(d.updatedAt).getTime())/60000;
      setStale(age>15);

      // 트럼프 뉴스 알림
      d.news.filter(n=>n.isTrump).slice(0,1).forEach((n:any)=>
        addAlert(`🎭 ${n.title.slice(0,55)}…`,'trump'));
    } catch(e) {
      console.warn('market-data.json 로드 실패:', e);
      setLoad(false);
    }
  },[]);

  // CoinGecko & Open ER API (실시간 보완 — CORS 가능)
  const loadRT = useCallback(async()=>{
    try {
      const cr=await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,binancecoin&order=market_cap_desc&price_change_percentage=24h');
      if(cr.ok) setCR(await cr.json());
    } catch {}
    try {
      const fx=await fetch('https://open.er-api.com/v6/latest/USD');
      if(fx.ok) { const d=await fx.json(); setFR(d.rates??{}); }
    } catch {}
  },[]);

  useEffect(()=>{
    setInterval(()=>setNow(new Date()),1000);
    loadStatic();
    loadRT();
    setInterval(loadStatic, 60_000);   // 1분마다 json 다시 로드
    setInterval(loadRT,     60_000);   // 1분마다 코인·환율 갱신
  },[]);

  const quotes = mdata?.quotes ?? {};
  const crypto = cryptoRT.length ? cryptoRT : (mdata?.crypto ?? []);
  const rawRates = Object.keys(forexRT).length ? forexRT : (mdata?.forex ?? {});
  const fg = mdata?.fearGreed ?? null;
  const news = mdata?.news ?? [];
  const ms=getMarketStatus();
  const today=new Date().toISOString().split('T')[0];

  const usdKrw=rawRates.KRW??0;
  const forexList=[
    {pair:'USD/KRW',flag:'🇺🇸',label:'달러/원',   r:usdKrw,                                                chg:0},
    {pair:'EUR/KRW',flag:'🇪🇺',label:'유로/원',   r:usdKrw&&rawRates.EUR?usdKrw/rawRates.EUR:0,            chg:0},
    {pair:'JPY/KRW',flag:'🇯🇵',label:'100엔/원',  r:usdKrw&&rawRates.JPY?(usdKrw/rawRates.JPY)*100:0,      chg:0},
    {pair:'CNY/KRW',flag:'🇨🇳',label:'위안/원',   r:usdKrw&&rawRates.CNY?usdKrw/rawRates.CNY:0,            chg:0},
    {pair:'GBP/KRW',flag:'🇬🇧',label:'파운드/원', r:usdKrw&&rawRates.GBP?usdKrw/rawRates.GBP:0,            chg:0},
  ];

  const filteredNews = nf==='all'?news:nf==='trump'?news.filter((n:any)=>n.isTrump):news.filter((n:any)=>n.category===nf);
  const upcoming=CALENDAR.filter(e=>e.date>=today);

  const updTime = mdata?.updatedAt ? new Date(mdata.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : null;

  const CHARTS=[['NASDAQ:NVDA','엔비디아'],['NASDAQ:MSFT','마이크로소프트'],['NYSE:LMT','록히드마틴'],
    ['KRX:005930','삼성전자'],['KRX:000660','SK하이닉스'],['BINANCE:BTCUSDT','비트코인'],
    ['TVC:GOLD','금'],['TVC:USOIL','WTI원유'],['INDEX:SPX','S&P500']];

  const tabS=(k:typeof tab): React.CSSProperties=>({padding:'8px 14px',border:'none',cursor:'pointer',fontSize:'12px',fontFamily:'inherit',borderBottom:tab===k?'2px solid #40c4ff':'2px solid transparent',background:'transparent',color:tab===k?'#40c4ff':'#546e7a',fontWeight:tab===k?'bold':'normal'});
  const fBtnS=(k:string): React.CSSProperties=>({padding:'3px 10px',borderRadius:'4px',border:`1px solid ${nf===k?'#40c4ff':'#1a2535'}`,background:nf===k?'#40c4ff22':'transparent',color:nf===k?'#40c4ff':'#546e7a',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'});

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
        <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
          <div style={{fontSize:'17px',fontWeight:'bold',background:'linear-gradient(90deg,#00d4ff,#00e676)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>◆ MARKET TERMINAL</div>
          <div style={{fontSize:'9px',color:'#37474f',letterSpacing:'1px'}}>GitHub Actions 10분 갱신 · yfinance · CoinGecko · Alternative.me · RSS</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px',fontSize:'11px'}}>
          {stale&&<span style={{color:'#ffd740',fontSize:'10px'}}>⚠ 데이터 15분 초과</span>}
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{background:ms.usStatus==='개장중'?'#00e67622':'#ff525222',border:`1px solid ${ms.usColor}44`,color:ms.usColor,padding:'3px 10px',borderRadius:'4px'}}>🇺🇸 US {ms.usStatus}</span>
            <span style={{background:ms.krStatus==='개장중'?'#00e67622':'#1a2535',color:ms.krStatus==='개장중'?'#00e676':'#546e7a',padding:'3px 10px',borderRadius:'4px'}}>🇰🇷 KR {ms.krStatus}</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:'bold',fontSize:'15px',color:'#40c4ff',fontFamily:'monospace'}}>{nowT.toLocaleTimeString('ko-KR',{hour12:false})}</div>
            <div style={{fontSize:'9px',color:'#37474f'}}>{nowT.toLocaleDateString('ko-KR')} KST</div>
          </div>
          {updTime&&<div style={{fontSize:'9px',color:'#00e676',textAlign:'right'}}><div>● 데이터 기준</div><div>{updTime}</div></div>}
          {loading&&<Spinner s={16}/>}
        </div>
      </div>

      {/* TICKER */}
      {!loading&&Object.keys(quotes).length>0&&(
        <div style={{background:'#040a14',borderBottom:'1px solid #1a2535',padding:'5px 0',overflow:'hidden',whiteSpace:'nowrap'}}>
          <div style={{display:'inline-block',animation:'ticker 60s linear infinite'}}>
            {[...IDX_META,...IDX_META].map((m,i)=>{
              const q=quotes[m.yf]; if(!q) return null;
              return <span key={i} style={{marginRight:'36px',fontSize:'11px'}}><span style={{color:'#546e7a'}}>{m.sym} </span><span style={{color:'#eceff1'}}>{fmt(q.price)} </span><span style={{color:clr(q.changePct)}}>{q.changePct>=0?'▲':'▼'}{Math.abs(q.changePct).toFixed(2)}%</span></span>;
            })}
            {[...COM_META,...COM_META].map((m,i)=>{
              const q=quotes[m.yf]; if(!q) return null;
              return <span key={'c'+i} style={{marginRight:'36px',fontSize:'11px'}}><span style={{color:'#546e7a'}}>{m.sym} </span><span style={{color:'#eceff1'}}>${fmt(q.price,['NG=F','HG=F'].includes(m.yf)?3:2)} </span><span style={{color:clr(q.changePct)}}>{q.changePct>=0?'▲':'▼'}{Math.abs(q.changePct).toFixed(2)}%</span></span>;
            })}
          </div>
        </div>
      )}

      <div style={{padding:'14px 16px',maxWidth:'1900px',margin:'0 auto'}}>

        {/* 로딩 / 첫 배포 안내 */}
        {loading&&(
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'30px',textAlign:'center',marginBottom:'14px'}}>
            <Spinner s={28}/><br/><br/>
            <div style={{color:'#90a4ae',fontSize:'13px'}}>데이터 로딩 중...</div>
            <div style={{color:'#546e7a',fontSize:'11px',marginTop:'8px'}}>
              GitHub Actions가 10분마다 최신 시장 데이터를 수집합니다.<br/>
              첫 배포 후 첫 실행(약 2분)이 끝나면 실제 데이터가 표시됩니다.
            </div>
          </div>
        )}

        {/* 주요 지수 */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>
            📊 주요 지수 <span style={{fontSize:'9px',color:'#546e7a',letterSpacing:'0'}}>· yfinance 실제 데이터 (10분 갱신)</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
            {IDX_META.map(m=><IdxCard key={m.yf} meta={m} q={quotes[m.yf]} spark={sparks[m.yf]??[]} loading={loading}/>)}
          </div>
        </div>

        {/* 사이드바 + 탭 */}
        <div style={{display:'grid',gridTemplateColumns:'230px 1fr',gap:'14px',marginBottom:'14px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px',textAlign:'center'}}>
              <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>🧠 공포&탐욕 지수</div>
              <FGGauge data={fg}/>
            </div>
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>📏 52주 위치 & 기회구간</div>
              {IDX_META.slice(0,4).map(m=>{
                const q=quotes[m.yf];
                if(!q||!q.high52w) return (
                  <div key={m.sym} style={{marginBottom:'10px'}}>
                    <div style={{fontSize:'10px',color:'#90a4ae',marginBottom:'3px'}}>{m.name}</div>
                    <div style={{height:'6px',background:'#1a2535',borderRadius:'3px'}}/>
                  </div>
                );
                const p=((q.price-q.low52w)/(q.high52w-q.low52w))*100;
                const fromATH=((m.ath-q.price)/m.ath*100);
                const zone=p<20?'🟢 기회구간':p>80?'🔴 고점권':p>60?'🟡 주의':'🔵 중간';
                return (
                  <div key={m.sym} style={{marginBottom:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'}}>
                      <span style={{color:'#90a4ae'}}>{m.name}</span>
                      <span style={{fontSize:'9px',color:'#546e7a'}}>ATH -{fromATH.toFixed(1)}%</span>
                    </div>
                    <div style={{position:'relative',height:'6px',background:'#1a2535',borderRadius:'3px',marginBottom:'3px'}}>
                      <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${Math.min(100,Math.max(0,p))}%`,background:p<20?'#00e676':p>80?'#ff5252':'#40c4ff',borderRadius:'3px',transition:'width .5s'}}/>
                    </div>
                    <div style={{fontSize:'9px',color:p<20?'#00e676':p>80?'#ff5252':'#546e7a'}}>{zone}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{display:'flex',borderBottom:'1px solid #1a2535',marginBottom:'12px'}}>
              <button style={tabS('news')} onClick={()=>setTab('news')}>📰 실시간 뉴스</button>
              <button style={tabS('cal')}  onClick={()=>setTab('cal')}>📅 경제 캘린더</button>
              <button style={tabS('chart')}onClick={()=>setTab('chart')}>📈 TradingView 차트</button>
            </div>

            {tab==='news'&&(
              <div>
                <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap',alignItems:'center'}}>
                  {[['all','전체'],['trump','🎭 트럼프'],['macro','🌐 매크로'],['tech','💻 테크'],['crypto','₿ 코인'],['korea','🇰🇷 한국'],['energy','⛽ 에너지'],['earnings','📊 실적']].map(([k,l])=>(
                    <button key={k} style={fBtnS(k)} onClick={()=>setNF(k)}>{l}</button>
                  ))}
                  <span style={{marginLeft:'auto',fontSize:'9px',color:news.length?'#00e676':'#546e7a'}}>
                    {news.length?`● ${news.length}건 수집됨`:'뉴스 로딩 중...'}
                  </span>
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px',maxHeight:'420px',overflowY:'auto'}}>
                  {filteredNews.length===0&&<div style={{textAlign:'center',color:'#37474f',padding:'40px',fontSize:'12px'}}>뉴스 없음 (GitHub Actions 첫 실행 대기 중)</div>}
                  {filteredNews.map((item:any)=>{
                    const SC={positive:'#00e676',negative:'#ff5252',neutral:'#ffd740'} as const;
                    const SI={positive:'↑ 호재',negative:'↓ 악재',neutral:'→ 중립'} as const;
                    return (
                      <div key={item.id} style={{borderBottom:'1px solid #1a2535',paddingBottom:'10px',marginBottom:'10px',padding:'6px',background:item.isTrump?'rgba(255,82,82,.03)':'transparent',borderRadius:'4px'}}>
                        <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'5px',flexWrap:'wrap'}}>
                          {item.isTrump&&<span style={{fontSize:'9px',background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'1px 5px',borderRadius:'3px',border:'1px solid rgba(255,82,82,.3)'}}>🎭 트럼프</span>}
                          <span style={{fontSize:'9px',color:SC[item.sentiment as keyof typeof SC],background:SC[item.sentiment as keyof typeof SC]+'22',padding:'1px 5px',borderRadius:'3px'}}>{SI[item.sentiment as keyof typeof SI]}</span>
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

            {tab==='cal'&&(
              <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'10px',maxHeight:'450px',overflowY:'auto'}}>
                <div style={{display:'flex',gap:'10px',fontSize:'10px',color:'#37474f',marginBottom:'8px',flexWrap:'wrap'}}>
                  {Object.entries(ETC).map(([k,c])=><span key={k}><span style={{color:c}}>■</span> {ETL[k as keyof typeof ETL]}</span>)}
                </div>
                {upcoming.map(ev=><CalItem key={ev.id} ev={ev} today={today}/>)}
              </div>
            )}

            {tab==='chart'&&(
              <div>
                <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap'}}>
                  {CHARTS.map(([s,n])=>(
                    <button key={s} onClick={()=>setCS(s)} style={{padding:'4px 10px',borderRadius:'4px',border:`1px solid ${chartSym===s?'#40c4ff':'#1a2535'}`,background:chartSym===s?'#40c4ff22':'transparent',color:chartSym===s?'#40c4ff':'#546e7a',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>{n}</button>
                  ))}
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',overflow:'hidden'}}>
                  <TVChart sym={chartSym}/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 섹터 */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>🔥 섹터 ETF & 종목 <span style={{fontSize:'9px',color:'#546e7a',letterSpacing:'0'}}>· yfinance 실제 등락률</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            {SECTOR_DEF.slice(0,3).map(d=><SectorCard key={d.yf} def={d} quotes={quotes} loading={loading}/>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px'}}>
            {SECTOR_DEF.slice(3).map(d=><SectorCard key={d.yf} def={d} quotes={quotes} loading={loading}/>)}
          </div>
        </div>

        {/* 암호화폐 + 환율 + 원자재 */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'14px',marginBottom:'14px'}}>
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>₿ 암호화폐 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● CoinGecko 실시간</span></div>
            {crypto.length===0&&<div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner s={20}/></div>}
            {crypto.map((c:any)=>(
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'30px',height:'30px',borderRadius:'50%',background:'#1a2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#ffd740',fontWeight:'bold'}}>{c.symbol.toUpperCase().slice(0,2)}</div>
                  <div><div style={{fontSize:'12px',color:'#eceff1',fontWeight:'bold'}}>{c.name}</div><div style={{fontSize:'10px',color:'#37474f'}}>{fmtCap(c.market_cap)}</div></div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px',color:'#f1f5f9',fontWeight:'bold'}}>${c.current_price.toLocaleString()}</div>
                  <div style={{fontSize:'11px',color:clr(c.price_change_percentage_24h),fontWeight:'bold'}}>{c.price_change_percentage_24h>=0?'▲':'▼'} {Math.abs(c.price_change_percentage_24h).toFixed(2)}%</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>💱 환율 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● Open ER API 실시간</span></div>
            {usdKrw===0&&<div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner s={20}/></div>}
            {usdKrw>0&&forexList.map(fx=>(
              <div key={fx.pair} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #1a2535'}}>
                <div><div style={{fontSize:'12px',color:'#eceff1'}}>{fx.flag} {fx.pair}</div><div style={{fontSize:'10px',color:'#37474f'}}>{fx.label}</div></div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'15px',fontWeight:'bold',color:'#f1f5f9'}}>₩{fmt(fx.r,1)}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>🪙 원자재 선물 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● yfinance 실시간</span></div>
            {COM_META.map(m=>{
              const q=quotes[m.yf];
              return (
                <div key={m.sym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                  <div><div style={{fontSize:'12px',color:'#eceff1',fontWeight:'bold'}}>{m.icon} {m.name}</div><div style={{fontSize:'9px',color:'#37474f'}}>{m.unit}</div></div>
                  <div style={{textAlign:'right'}}>
                    {loading||!q?<Spinner/>:<>
                      <div style={{fontSize:'13px',color:'#f1f5f9',fontWeight:'bold'}}>${fmt(q.price,['NG=F','HG=F'].includes(m.yf)?3:2)}</div>
                      <div style={{fontSize:'11px',color:clr(q.changePct),fontWeight:'bold'}}>{q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%</div>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{borderTop:'1px solid #1a2535',paddingTop:'10px',display:'flex',justifyContent:'space-between',fontSize:'9px',color:'#37474f',flexWrap:'wrap',gap:'6px'}}>
          <span>⚡ GitHub Actions 10분 갱신 (public repo → Actions 무료·무제한)</span>
          <span>📡 yfinance(지수·원자재·주식) · CoinGecko(코인) · Open ER API(환율) · Alternative.me(F&G) · RSS(뉴스)</span>
          <span>⚠️ 투자 판단은 본인 책임 | © 2026 Market Terminal</span>
        </div>
      </div>
    </div>
  );
}
