/**
 * MobileDashboard — Galaxy S25 최적화
 * 페이지 형식 레이아웃 / 대형 캘린더 / 배당 + 실적 통합
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

const DATA_URL = './market-data.json';

// ── 메타 데이터 ─────────────────────────────────────────────────────
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
  { yf:'GC=F', name:'금',      unit:'USD/oz',    icon:'🥇' },
  { yf:'SI=F', name:'은',      unit:'USD/oz',    icon:'🥈' },
  { yf:'CL=F', name:'WTI원유', unit:'USD/bbl',   icon:'🛢️' },
  { yf:'BZ=F', name:'브렌트유',unit:'USD/bbl',   icon:'⛽' },
  { yf:'NG=F', name:'천연가스',unit:'USD/MMBtu', icon:'🔥' },
  { yf:'HG=F', name:'구리',    unit:'USD/lb',    icon:'🔶' },
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

// ── 이벤트 색상 ─────────────────────────────────────────────────────
const EVT_COLOR: Record<string,string> = {
  fed:'#ffd740', earnings:'#40c4ff', economic:'#00e676',
  options:'#ff9100', geopolitical:'#ff5252', dividend:'#ce93d8',
};
const EVT_LABEL: Record<string,string> = {
  fed:'Fed', earnings:'실적', economic:'경제', options:'옵션', geopolitical:'지정학', dividend:'배당',
};

// ── 캘린더 이벤트 (경제지표 + 실적) ────────────────────────────────
const ECON_EVENTS = [
  { id:'e1',  date:'2026-04-02', title:'상호관세 발효',          imp:'high', type:'geopolitical', desc:'전 세계 교역국 대상 상호관세' },
  { id:'e2',  date:'2026-04-04', title:'美 고용보고서 (NFP)',    imp:'high', type:'economic',     desc:'3월 비농업 고용지표' },
  { id:'e3',  date:'2026-04-07', title:'FOMC 의사록',           imp:'high', type:'fed',          desc:'3월 FOMC 의사록 공개' },
  { id:'e4',  date:'2026-04-10', title:'美 CPI',                imp:'high', type:'economic',     desc:'3월 소비자물가지수' },
  { id:'e5',  date:'2026-04-14', title:'옵션 만기일',           imp:'med',  type:'options',      desc:'4월 월물 만기' },
  { id:'e6',  date:'2026-04-14', title:'JP모건 실적',           imp:'high', type:'earnings',     desc:'JP모건 1Q 실적' },
  { id:'e7',  date:'2026-04-15', title:'넷플릭스 실적',         imp:'high', type:'earnings',     desc:'Netflix 1Q 실적' },
  { id:'e8',  date:'2026-04-22', title:'테슬라 실적',           imp:'high', type:'earnings',     desc:'Tesla 1Q 실적' },
  { id:'e9',  date:'2026-04-22', title:'TSMC 실적',             imp:'high', type:'earnings',     desc:'TSMC 1Q 실적' },
  { id:'e10', date:'2026-04-23', title:'알파벳(구글) 실적',     imp:'high', type:'earnings',     desc:'Alphabet 1Q 실적' },
  { id:'e11', date:'2026-04-24', title:'메타 실적',             imp:'high', type:'earnings',     desc:'Meta 1Q 실적' },
  { id:'e12', date:'2026-04-25', title:'FOMC 금리 결정',        imp:'high', type:'fed',          desc:'파월 기자회견' },
  { id:'e13', date:'2026-04-28', title:'삼성전자 잠정실적',     imp:'high', type:'earnings',     desc:'삼성전자 1Q 잠정 실적' },
  { id:'e14', date:'2026-04-30', title:'Microsoft 실적',        imp:'high', type:'earnings',     desc:'Microsoft 1Q 실적' },
  { id:'e15', date:'2026-04-30', title:'美 GDP 속보치',         imp:'high', type:'economic',     desc:'1Q GDP 잠정치' },
  { id:'e16', date:'2026-05-01', title:'Apple 실적',            imp:'high', type:'earnings',     desc:'Apple 2Q 실적' },
  { id:'e17', date:'2026-05-01', title:'아마존 실적',           imp:'high', type:'earnings',     desc:'Amazon 1Q 실적' },
  { id:'e18', date:'2026-05-02', title:'美 고용보고서 (4월)',   imp:'high', type:'economic',     desc:'4월 비농업 고용지표' },
  { id:'e19', date:'2026-05-28', title:'엔비디아 실적',         imp:'high', type:'earnings',     desc:'NVDA 1Q 실적' },
];

// ── 배당 이벤트 ─────────────────────────────────────────────────────
// ※ 사용자 종목 확정 후 업데이트 예정 (현재: 주요 보유 후보군)
// amount: 주당 배당금 (USD), prevChg: 전년 대비 증가율(%), amountUnknown: true면 전년 기준 표기
const DIVIDENDS = [
  { id:'dv1',  exDate:'2026-04-14', payDate:'2026-04-25', sym:'LMT',         name:'록히드마틴',       amount:3.30,   prevChg:5.1,  currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv2',  exDate:'2026-04-15', payDate:'2026-05-01', sym:'RTX',         name:'레이시온',         amount:0.63,   prevChg:6.8,  currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv3',  exDate:'2026-04-16', payDate:'2026-05-02', sym:'XOM',         name:'엑슨모빌',         amount:0.99,   prevChg:4.2,  currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv4',  exDate:'2026-04-17', payDate:'2026-05-05', sym:'CVX',         name:'쉐브론',           amount:1.71,   prevChg:8.2,  currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv5',  exDate:'2026-04-23', payDate:'2026-05-09', sym:'REGN',        name:'리제네론',         amount:0.00,   prevChg:0,    currency:'USD', period:'없음', amountUnknown:true  },
  { id:'dv6',  exDate:'2026-05-09', payDate:'2026-05-15', sym:'NVDA',        name:'엔비디아',         amount:0.01,   prevChg:100,  currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv7',  exDate:'2026-05-14', payDate:'2026-06-11', sym:'MSFT',        name:'마이크로소프트',   amount:0.83,   prevChg:10.7, currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv8',  exDate:'2026-05-08', payDate:'2026-05-15', sym:'AAPL',        name:'애플',             amount:0.25,   prevChg:4.2,  currency:'USD', period:'분기', amountUnknown:false },
  { id:'dv9',  exDate:'2026-04-25', payDate:'2026-05-15', sym:'005930.KS',   name:'삼성전자',         amount:361,    prevChg:0,    currency:'KRW', period:'분기', amountUnknown:false },
  { id:'dv10', exDate:'2026-05-20', payDate:'2026-06-10', sym:'000660.KS',   name:'SK하이닉스',       amount:300,    prevChg:0,    currency:'KRW', period:'분기', amountUnknown:true  },
  { id:'dv11', exDate:'2026-04-29', payDate:'2026-05-20', sym:'012450.KS',   name:'한화에어로스페이스',amount:500,   prevChg:25.0, currency:'KRW', period:'분기', amountUnknown:false },
  // ※ 사용자 추가 종목 여기에 입력 예정
];

const MONTHS_KO = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAYS_KO   = ['일','월','화','수','목','금','토'];

const ETF_DB = [
  { sym:'SPY',  name:'S&P500',   tag:'분산', color:'#40c4ff', desc:'미국 500대 기업',     fgRange:[0,100] },
  { sym:'QQQ',  name:'나스닥100', tag:'성장', color:'#00e676', desc:'빅테크·AI 집중',       fgRange:[45,80] },
  { sym:'XLK',  name:'AI·테크',   tag:'섹터', color:'#b39ddb', desc:'반도체·소프트웨어',   fgRange:[45,80] },
  { sym:'SOXX', name:'반도체',    tag:'테마', color:'#80deea', desc:'AI 인프라 수혜',       fgRange:[40,75] },
  { sym:'ITA',  name:'방위산업',  tag:'방어', color:'#ffd740', desc:'지정학 리스크 헤지',   fgRange:[0,60]  },
  { sym:'IBB',  name:'바이오',    tag:'테마', color:'#a5d6a7', desc:'신약·고령화 테마',     fgRange:[30,70] },
  { sym:'GLD',  name:'금 ETF',    tag:'헤지', color:'#ffe082', desc:'인플레 헤지',          fgRange:[0,45]  },
  { sym:'TLT',  name:'장기국채',  tag:'채권', color:'#90a4ae', desc:'금리 하락 포지션',     fgRange:[0,40]  },
];

// ── 인터페이스 ──────────────────────────────────────────────────────
interface Quote { price:number; change:number; changePct:number; high52w:number; low52w:number; }
interface MarketData {
  updatedAt:string; quotes:Record<string,Quote>; crypto:any[];
  forex:Record<string,number>; fearGreed:{value:number;label:string}; news:any[];
}

// ── 유틸 ────────────────────────────────────────────────────────────
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

const Spinner = ({s=18}:{s?:number}) => (
  <span style={{display:'inline-block',width:s,height:s,border:'2px solid #1a3050',borderTop:'2px solid #40c4ff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
);

// ── 공통 페이지 헤더 ────────────────────────────────────────────────
const PageHeader: React.FC<{icon:string;title:string;sub?:string}> = ({icon,title,sub}) => (
  <div style={{padding:'20px 16px 12px'}}>
    <div style={{fontSize:'22px',fontWeight:'700',color:'#eceff1',display:'flex',alignItems:'center',gap:'8px'}}>
      <span>{icon}</span><span>{title}</span>
    </div>
    {sub&&<div style={{fontSize:'12px',color:'#546e7a',marginTop:'4px'}}>{sub}</div>}
  </div>
);

// ── 섹션 타이틀 ─────────────────────────────────────────────────────
const SectionTitle: React.FC<{children:React.ReactNode;right?:React.ReactNode}> = ({children,right}) => (
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 16px',marginBottom:'10px',marginTop:'8px'}}>
    <div style={{fontSize:'13px',fontWeight:'700',color:'#40c4ff',letterSpacing:'1px'}}>{children}</div>
    {right&&<div style={{fontSize:'11px',color:'#546e7a'}}>{right}</div>}
  </div>
);

// ── 공포탐욕 게이지 ─────────────────────────────────────────────────
const FGGauge: React.FC<{data:{value:number;label:string}|null}> = ({data}) => {
  if(!data) return <div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner s={28}/></div>;
  const v=Math.max(0,Math.min(100,data.value));
  const zones=[{c:'#ff1744',max:20},{c:'#ff6d00',max:40},{c:'#ffd740',max:60},{c:'#b2ff59',max:80},{c:'#00e676',max:100}];
  const zone=zones.find(z=>v<=z.max)??zones[4];
  const rad=((v/100)*180-90)*Math.PI/180;
  const cx=100,cy=90,r=72;
  const LABEL:Record<string,string>={'Extreme Fear':'극도의 공포','Fear':'공포','Neutral':'중립','Greed':'탐욕','Extreme Greed':'극도의 탐욕'};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0'}}>
      <svg width={200} height={110} viewBox="0 0 200 110">
        {zones.map((z,i)=>{
          const a0=(i/zones.length)*Math.PI,a1=((i+1)/zones.length)*Math.PI,r1=72,r2=50;
          const p=(a:number)=>([cx-r1*Math.cos(a),cy-r1*Math.sin(a),cx-r2*Math.cos(a),cy-r2*Math.sin(a)]);
          const [x1,y1,x2,y2]=p(a0),[x4,y4,x3,y3]=p(a1);
          return <path key={i} d={`M${x1} ${y1} A${r1} ${r1} 0 0 1 ${x4} ${y4} L${x3} ${y3} A${r2} ${r2} 0 0 0 ${x2} ${y2}Z`} fill={z.c} opacity={.4}/>;
        })}
        <line x1={cx} y1={cy} x2={cx+r*Math.sin(rad)} y2={cy-r*Math.cos(rad)} stroke={zone.c} strokeWidth="3.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={7} fill={zone.c}/>
        <text x={cx} y={cy-18} textAnchor="middle" fill={zone.c} fontSize="26" fontWeight="bold">{v}</text>
      </svg>
      <div style={{fontSize:'18px',fontWeight:'700',color:zone.c,marginTop:'-4px'}}>{LABEL[data.label]??data.label}</div>
      <div style={{fontSize:'12px',color:'#546e7a',marginTop:'4px'}}>Alternative.me 공포&탐욕 지수</div>
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
    s.innerHTML=JSON.stringify({symbol:sym,interval:'D',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',backgroundColor:'#060d1a',gridColor:'rgba(30,50,80,0.3)',width:'100%',height:360,studies:['RSI@tv-basicstudies']});
    ref.current.appendChild(s);
    return ()=>{if(ref.current)ref.current.innerHTML='';};
  },[sym]);
  return <div ref={ref} style={{width:'100%',height:360}}/>;
};

// ════════════════════════════════════════════════
// TAB PAGES
// ════════════════════════════════════════════════

// ── 📊 시장 탭 ──────────────────────────────────────────────────────
const MarketPage: React.FC<{quotes:Record<string,Quote>;crypto:any[];rawRates:Record<string,number>;fg:{value:number;label:string}|null;loading:boolean}> = ({quotes,crypto,rawRates,fg,loading}) => {
  const [section,setSection]=useState<'index'|'crypto'|'forex'|'commodity'>('index');
  const usdKrw=rawRates.KRW??0;
  const forexList=[
    {pair:'USD/KRW',flag:'🇺🇸',label:'달러/원',   r:usdKrw},
    {pair:'EUR/KRW',flag:'🇪🇺',label:'유로/원',   r:usdKrw&&rawRates.EUR?usdKrw/rawRates.EUR:0},
    {pair:'JPY/KRW',flag:'🇯🇵',label:'100엔/원',  r:usdKrw&&rawRates.JPY?(usdKrw/rawRates.JPY)*100:0},
    {pair:'CNY/KRW',flag:'🇨🇳',label:'위안/원',   r:usdKrw&&rawRates.CNY?usdKrw/rawRates.CNY:0},
    {pair:'GBP/KRW',flag:'🇬🇧',label:'파운드/원', r:usdKrw&&rawRates.GBP?usdKrw/rawRates.GBP:0},
  ];

  const tabs=[{k:'index',l:'지수'},{k:'crypto',l:'코인'},{k:'forex',l:'환율'},{k:'commodity',l:'원자재'}] as const;

  return (
    <div>
      <PageHeader icon="📊" title="시장 현황" sub="yfinance · CoinGecko · Open ER API"/>

      {/* 공포탐욕 */}
      <div style={{margin:'0 16px 16px',background:'#0d1b2e',borderRadius:'16px',padding:'16px',border:'1px solid #1a3050'}}>
        <FGGauge data={fg}/>
      </div>

      {/* 서브 탭 */}
      <div style={{display:'flex',gap:'0',margin:'0 16px 16px',background:'#0d1b2e',borderRadius:'12px',padding:'4px',border:'1px solid #1a3050'}}>
        {tabs.map(t=>(
          <button key={t.k} onClick={()=>setSection(t.k)} style={{
            flex:1,padding:'10px 4px',border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'600',
            background:section===t.k?'#1a3050':'transparent',
            color:section===t.k?'#40c4ff':'#546e7a',
          }}>{t.l}</button>
        ))}
      </div>

      {/* 지수 */}
      {section==='index'&&(
        <div style={{padding:'0 16px'}}>
          {loading?<div style={{textAlign:'center',padding:'40px'}}><Spinner s={28}/></div>:
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {IDX_META.map(m=>{
                const q=quotes[m.yf]; const c=clr(q?.changePct??0);
                const pct52=q&&q.high52w&&q.low52w&&q.high52w!==q.low52w?((q.price-q.low52w)/(q.high52w-q.low52w))*100:null;
                const zone=pct52==null?null:pct52<20?{t:'🟢 기회구간',c:'#00e676'}:pct52>80?{t:'🔴 고점권',c:'#ff5252'}:pct52>60?{t:'🟡 주의',c:'#ffd740'}:{t:'🔵 중간',c:'#546e7a'};
                return (
                  <div key={m.yf} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px',border:`1px solid ${c}22`,borderLeft:`4px solid ${c}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                      <div>
                        <div style={{fontSize:'12px',color:'#546e7a',letterSpacing:'1px'}}>{m.sym}</div>
                        <div style={{fontSize:'16px',fontWeight:'700',color:'#90a4ae'}}>{m.name}</div>
                      </div>
                      {zone&&<span style={{fontSize:'12px',color:zone.c,fontWeight:'600'}}>{zone.t}</span>}
                    </div>
                    {!q?<div style={{color:'#37474f'}}>—</div>:<>
                      <div style={{fontSize:'26px',fontWeight:'700',color:'#eceff1',marginBottom:'8px'}}>{fmt(q.price)}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <span style={{background:bg(q.changePct),color:c,padding:'5px 12px',borderRadius:'8px',fontSize:'14px',fontWeight:'700'}}>
                          {q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%
                        </span>
                        <span style={{fontSize:'13px',color:'#546e7a'}}>{q.change>=0?'+':''}{fmt(q.change)}</span>
                      </div>
                      {pct52!=null&&(
                        <div style={{marginTop:'12px'}}>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#37474f',marginBottom:'4px'}}>
                            <span>52주 저점 ₩{fmt(q.low52w)}</span>
                            <span>고점 ₩{fmt(q.high52w)}</span>
                          </div>
                          <div style={{background:'#1a2535',height:'6px',borderRadius:'3px'}}>
                            <div style={{height:'100%',width:`${Math.min(100,Math.max(0,pct52))}%`,background:pct52<20?'#00e676':pct52>80?'#ff5252':'#40c4ff',borderRadius:'3px'}}/>
                          </div>
                        </div>
                      )}
                    </>}
                  </div>
                );
              })}
            </div>
          }
          <div style={{height:'16px'}}/>
        </div>
      )}

      {/* 코인 */}
      {section==='crypto'&&(
        <div style={{padding:'0 16px'}}>
          <div style={{fontSize:'11px',color:'#00e676',marginBottom:'12px'}}>● CoinGecko 실시간</div>
          {crypto.length===0?<div style={{textAlign:'center',padding:'40px'}}><Spinner s={28}/></div>:
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {crypto.map((c:any)=>(
                <div key={c.id} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px',border:'1px solid #1a3050',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'#1a2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',color:'#ffd740',fontWeight:'700'}}>{c.symbol.toUpperCase().slice(0,2)}</div>
                    <div>
                      <div style={{fontSize:'16px',color:'#eceff1',fontWeight:'700'}}>{c.name}</div>
                      <div style={{fontSize:'12px',color:'#37474f',marginTop:'2px'}}>{fmtC(c.market_cap)}</div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'17px',color:'#f1f5f9',fontWeight:'700'}}>${c.current_price.toLocaleString()}</div>
                    <div style={{fontSize:'14px',color:clr(c.price_change_percentage_24h),fontWeight:'700',marginTop:'2px'}}>{c.price_change_percentage_24h>=0?'▲':'▼'} {Math.abs(c.price_change_percentage_24h).toFixed(2)}%</div>
                  </div>
                </div>
              ))}
            </div>
          }
          <div style={{height:'16px'}}/>
        </div>
      )}

      {/* 환율 */}
      {section==='forex'&&(
        <div style={{padding:'0 16px'}}>
          <div style={{fontSize:'11px',color:'#00e676',marginBottom:'12px'}}>● Open ER API 실시간</div>
          {usdKrw===0?<div style={{textAlign:'center',padding:'40px'}}><Spinner s={28}/></div>:
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {forexList.map(fx=>(
                <div key={fx.pair} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px 20px',border:'1px solid #1a3050',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:'18px',fontWeight:'700',color:'#eceff1'}}>{fx.flag} {fx.pair}</div>
                    <div style={{fontSize:'12px',color:'#546e7a',marginTop:'3px'}}>{fx.label}</div>
                  </div>
                  <div style={{fontSize:'22px',fontWeight:'700',color:'#f1f5f9'}}>₩{fmt(fx.r,1)}</div>
                </div>
              ))}
            </div>
          }
          <div style={{height:'16px'}}/>
        </div>
      )}

      {/* 원자재 */}
      {section==='commodity'&&(
        <div style={{padding:'0 16px'}}>
          <div style={{fontSize:'11px',color:'#00e676',marginBottom:'12px'}}>● yfinance 실시간</div>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {COM_META.map(m=>{
              const q=quotes[m.yf];
              return (
                <div key={m.yf} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px',border:'1px solid #1a3050',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:'18px',marginBottom:'4px'}}>{m.icon} <span style={{fontSize:'16px',fontWeight:'700',color:'#eceff1'}}>{m.name}</span></div>
                    <div style={{fontSize:'12px',color:'#546e7a'}}>{m.unit}</div>
                  </div>
                  {!q?<Spinner/>:<div style={{textAlign:'right'}}>
                    <div style={{fontSize:'19px',color:'#f1f5f9',fontWeight:'700'}}>${fmt(q.price,['NG=F','HG=F'].includes(m.yf)?3:2)}</div>
                    <div style={{fontSize:'14px',color:clr(q.changePct),fontWeight:'700',marginTop:'2px'}}>{q.changePct>=0?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%</div>
                  </div>}
                </div>
              );
            })}
          </div>
          <div style={{height:'16px'}}/>
        </div>
      )}
    </div>
  );
};

// ── 📰 뉴스 탭 ──────────────────────────────────────────────────────
const NewsPage: React.FC<{news:any[]}> = ({news}) => {
  const [nf,setNF]=useState('all');
  const filters=[['all','전체'],['trump','🎭 트럼프'],['macro','매크로'],['tech','테크'],['crypto','코인'],['korea','한국'],['energy','에너지'],['earnings','실적']];
  const filtered=nf==='all'?news:nf==='trump'?news.filter((n:any)=>n.isTrump):news.filter((n:any)=>n.category===nf);
  return (
    <div>
      <PageHeader icon="📰" title="실시간 뉴스" sub={news.length?`${news.length}건 · 한국어 번역 (deep-translator)`:'GitHub Actions 데이터 대기 중'}/>
      {/* 필터 칩 */}
      <div style={{display:'flex',gap:'8px',overflowX:'auto',padding:'0 16px 12px',scrollbarWidth:'none'}}>
        {filters.map(([k,l])=>(
          <button key={k} onClick={()=>setNF(k)} style={{
            flexShrink:0,padding:'8px 16px',borderRadius:'20px',border:`1px solid ${nf===k?'#40c4ff':'#1a2535'}`,
            background:nf===k?'#40c4ff22':'#0d1b2e',color:nf===k?'#40c4ff':'#90a4ae',
            cursor:'pointer',fontSize:'13px',whiteSpace:'nowrap',fontWeight:nf===k?'700':'400',
          }}>{l}</button>
        ))}
      </div>
      <div style={{padding:'0 16px'}}>
        {filtered.length===0&&<div style={{textAlign:'center',color:'#37474f',padding:'60px',fontSize:'14px'}}>뉴스 없음</div>}
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {filtered.map((item:any)=>{
            const SC={positive:'#00e676',negative:'#ff5252',neutral:'#ffd740'} as const;
            const SI={positive:'↑ 호재',negative:'↓ 악재',neutral:'→ 중립'} as const;
            return (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                <div style={{background:item.isTrump?'rgba(255,82,82,.06)':'#0d1b2e',border:`1px solid ${item.isTrump?'rgba(255,82,82,.25)':'#1a2535'}`,borderRadius:'14px',padding:'16px'}}>
                  <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'10px',flexWrap:'wrap'}}>
                    {item.isTrump&&<span style={{fontSize:'11px',background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'3px 8px',borderRadius:'10px',border:'1px solid rgba(255,82,82,.3)',fontWeight:'600'}}>🎭 트럼프</span>}
                    <span style={{fontSize:'11px',color:SC[item.sentiment as keyof typeof SC],background:SC[item.sentiment as keyof typeof SC]+'22',padding:'3px 8px',borderRadius:'10px',fontWeight:'600'}}>{SI[item.sentiment as keyof typeof SI]}</span>
                    <span style={{fontSize:'11px',color:'#37474f',marginLeft:'auto'}}>{item.source} · {item.time}</span>
                  </div>
                  <div style={{fontSize:'15px',color:'#cfd8dc',lineHeight:'1.65',fontWeight:'500'}}>{highlight(item.title)}</div>
                </div>
              </a>
            );
          })}
        </div>
        <div style={{height:'16px'}}/>
      </div>
    </div>
  );
};

// ── 🧭 분석 탭 ──────────────────────────────────────────────────────
const AnalysisPage: React.FC<{quotes:Record<string,Quote>;fg:{value:number;label:string}|null;loading:boolean}> = ({quotes,fg,loading}) => {
  const fgVal=fg?.value??50;
  const sectorPerf=SECTOR_DEF.map(s=>({...s,pct:quotes[s.yf]?.changePct??0,ok:!!quotes[s.yf]})).filter(s=>s.ok).sort((a,b)=>b.pct-a.pct);
  const positions=IDX_META.map(m=>{const q=quotes[m.yf];if(!q||!q.high52w||!q.low52w||q.high52w===q.low52w)return null;return((q.price-q.low52w)/(q.high52w-q.low52w))*100;}).filter((v):v is number=>v!=null);
  const avgPos=positions.length?positions.reduce((a,b)=>a+b,0)/positions.length:50;
  let phase='',phaseColor='',strategy='',phaseDesc='';
  if(fgVal<25&&avgPos<35){phase='극단적 공포 — 매수 타이밍';phaseColor='#00e676';phaseDesc='역사적으로 중장기 매수 기회 구간';strategy='분할매수 시작 권장 (SPY·QQQ)';}
  else if(fgVal<40){phase='공포 구간 — 방어적 관망';phaseColor='#ffd740';phaseDesc='시장 심리 위축. 헤지 자산 병행 권장';strategy='금(GLD)·방산(ITA) 비중 유지';}
  else if(fgVal>75&&avgPos>70){phase='과열 경계 — 익절 고려';phaseColor='#ff5252';phaseDesc='탐욕 과열 + 고점권. 차익 실현 구간';strategy='일부 익절, 현금·채권 비중 확대';}
  else if(fgVal>60){phase='상승 추세 — 모멘텀 추종';phaseColor='#00e676';phaseDesc='긍정적 심리 지속. 모멘텀 섹터 집중';strategy='성장 ETF 비중 확대 (QQQ·SOXX)';}
  else{phase='중립 — 선별적 접근';phaseColor='#90a4ae';phaseDesc='방향성 불명확. 섹터 로테이션 주시';strategy='분산 유지, 한 섹터 집중 지양';}
  const recEtfs=ETF_DB.filter(e=>fgVal>=e.fgRange[0]&&fgVal<=e.fgRange[1]).slice(0,4);

  return (
    <div>
      <PageHeader icon="🧭" title="시장 분석" sub="공포&탐욕 + 52주 포지션 기반 자동 분석"/>

      {/* 시장 국면 */}
      <div style={{margin:'0 16px 14px',background:'#0d1b2e',borderRadius:'16px',padding:'20px',border:`1px solid ${phaseColor}33`}}>
        <div style={{fontSize:'13px',color:'#546e7a',marginBottom:'8px'}}>현재 시장 국면</div>
        <div style={{fontSize:'18px',fontWeight:'700',color:phaseColor,marginBottom:'8px'}}>{phase}</div>
        <div style={{fontSize:'14px',color:'#90a4ae',lineHeight:'1.6',marginBottom:'14px'}}>{phaseDesc}</div>
        <div style={{background:phaseColor+'12',borderLeft:`4px solid ${phaseColor}`,padding:'12px 14px',borderRadius:'8px',fontSize:'14px',color:phaseColor,lineHeight:'1.5',marginBottom:'16px'}}>
          💡 {strategy}
        </div>
        <div style={{display:'flex',gap:'24px'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'32px',fontWeight:'700',color:fgVal<40?'#ff5252':fgVal>60?'#00e676':'#ffd740'}}>{fgVal}</div>
            <div style={{fontSize:'12px',color:'#546e7a',marginTop:'2px'}}>공포&탐욕</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:'32px',fontWeight:'700',color:avgPos<30?'#00e676':avgPos>70?'#ff5252':'#40c4ff'}}>{avgPos.toFixed(0)}%</div>
            <div style={{fontSize:'12px',color:'#546e7a',marginTop:'2px'}}>52주 평균</div>
          </div>
        </div>
      </div>

      {/* 섹터 순위 */}
      <SectionTitle>🔥 섹터 성과 순위</SectionTitle>
      <div style={{margin:'0 16px 14px',background:'#0d1b2e',borderRadius:'16px',padding:'16px',border:'1px solid #1a3050'}}>
        {sectorPerf.length===0?<div style={{color:'#37474f',fontSize:'13px',padding:'10px'}}>로딩 중...</div>:
          sectorPerf.map((s,i)=>(
            <div key={s.yf} style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:i<sectorPerf.length-1?'14px':'0'}}>
              <div style={{fontSize:'13px',color:'#546e7a',width:'18px',textAlign:'right',flexShrink:0,fontWeight:'700'}}>{i+1}</div>
              <div style={{fontSize:'22px',flexShrink:0}}>{s.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'5px'}}>
                  <span style={{fontSize:'15px',color:'#eceff1',fontWeight:'600'}}>{s.name}</span>
                  <span style={{fontSize:'16px',fontWeight:'700',color:clr(s.pct)}}>{s.pct>=0?'+':''}{s.pct.toFixed(2)}%</span>
                </div>
                <div style={{height:'6px',background:'#1a2535',borderRadius:'3px'}}>
                  <div style={{height:'100%',width:`${Math.min(100,Math.abs(s.pct)*20+10)}%`,background:clr(s.pct),borderRadius:'3px'}}/>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* ETF 추천 */}
      <SectionTitle>💼 추천 ETF</SectionTitle>
      <div style={{padding:'0 16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
        {recEtfs.map((e,i)=>(
          <div key={e.sym} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px',border:`1px solid ${e.color}33`,position:'relative'}}>
            {i===0&&<div style={{position:'absolute',top:'10px',right:'10px',fontSize:'9px',background:'#ffd740',color:'#060d1a',borderRadius:'4px',padding:'2px 7px',fontWeight:'700'}}>TOP</div>}
            <div style={{background:e.color+'22',color:e.color,fontSize:'11px',padding:'3px 9px',borderRadius:'10px',display:'inline-block',marginBottom:'8px',fontWeight:'700'}}>{e.tag}</div>
            <div style={{fontSize:'20px',fontWeight:'700',color:e.color,marginBottom:'3px'}}>{e.sym}</div>
            <div style={{fontSize:'13px',color:'#90a4ae',marginBottom:'4px'}}>{e.name}</div>
            <div style={{fontSize:'12px',color:'#546e7a',lineHeight:'1.4'}}>{e.desc}</div>
          </div>
        ))}
      </div>

      {/* 섹터별 종목 */}
      <SectionTitle>📋 섹터별 종목</SectionTitle>
      <div style={{padding:'0 16px'}}>
        {SECTOR_DEF.map(def=>{
          const etfQ=quotes[def.yf];
          return (
            <div key={def.yf} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px',marginBottom:'10px',border:'1px solid #1a3050'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <span style={{fontSize:'22px'}}>{def.icon}</span>
                  <div>
                    <div style={{fontSize:'16px',fontWeight:'700',color:'#eceff1'}}>{def.name}</div>
                    <div style={{fontSize:'12px',color:'#37474f'}}>{def.yf} ETF</div>
                  </div>
                </div>
                <span style={{color:clr(etfQ?.changePct??0),fontWeight:'700',fontSize:'16px'}}>{etfQ?(etfQ.changePct>=0?'+':'')+etfQ.changePct.toFixed(2)+'%':'—'}</span>
              </div>
              {def.stocks.map((sym,i)=>{
                const q=quotes[sym];const c=clr(q?.changePct??0);
                return (
                  <div key={sym} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderTop:'1px solid #1a2535'}}>
                    <span style={{fontSize:'12px',color:'#546e7a',width:'52px',flexShrink:0,fontWeight:'600'}}>{sym.replace('.KS','')}</span>
                    <span style={{fontSize:'14px',color:'#b0bec5',flex:1}}>{STOCK_NAME[sym]??sym}</span>
                    {!q?<Spinner/>:<span style={{color:c,fontSize:'15px',fontWeight:'700',flexShrink:0}}>{q.changePct>=0?'+':''}{q.changePct.toFixed(2)}%</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div style={{height:'16px'}}/>
      </div>
    </div>
  );
};

// ── 📅 캘린더 탭 ────────────────────────────────────────────────────
const CalendarPage: React.FC<{today:string}> = ({today}) => {
  const td=new Date(today+'T00:00:00');
  const [yr,setYr]=useState(td.getFullYear());
  const [mo,setMo]=useState(td.getMonth());
  const [typeFilter,setTypeFilter]=useState<string>('all');
  const [sel,setSel]=useState<any|null>(null);

  const prev=()=>{if(mo===0){setYr(y=>y-1);setMo(11);}else setMo(m=>m-1);};
  const next=()=>{if(mo===11){setYr(y=>y+1);setMo(0);}else setMo(m=>m+1);};
  const goT =()=>{setYr(td.getFullYear());setMo(td.getMonth());};

  // 경제 이벤트 + 배당 이벤트 통합
  const allEvents = [
    ...ECON_EVENTS.map(e=>({...e, isDiv:false})),
    ...DIVIDENDS.map(d=>({
      id:d.id, date:d.exDate, isDiv:true,
      title:`${d.sym} 배당 기준일`,
      imp:d.amountUnknown?'med':'high',
      type:'dividend' as const,
      desc: d.amountUnknown
        ? `${d.name} · 전년 ${d.currency==='KRW'?`₩${d.prevChg.toFixed(0)}`:`$${(d.prevChg/100).toFixed(2)}`} 수준 (미확정)`
        : `${d.name} · ${d.currency==='KRW'?`₩${d.amount}`:`$${d.amount.toFixed(2)}`}/주 (지급일 ${d.payDate.slice(5)})`,
      sym: d.sym, amount: d.amount, currency: d.currency, payDate: d.payDate, amountUnknown: d.amountUnknown,
    })),
  ];

  const typeFilters=[
    {k:'all',l:'전체'},
    {k:'economic',l:'경제'},
    {k:'earnings',l:'실적'},
    {k:'fed',l:'Fed'},
    {k:'geopolitical',l:'지정학'},
    {k:'dividend',l:'배당'},
    {k:'options',l:'옵션'},
  ];

  const filtered=typeFilter==='all'?allEvents:allEvents.filter(e=>e.type===typeFilter);

  const dim=new Date(yr,mo+1,0).getDate();
  const fdow=new Date(yr,mo,1).getDay();
  const weeks:(number|null)[][]=[];
  let row:(number|null)[]=Array(fdow).fill(null);
  for(let d=1;d<=dim;d++){row.push(d);if(row.length===7){weeks.push(row);row=[];}}
  if(row.length>0){while(row.length<7)row.push(null);weeks.push(row);}

  const upcoming=filtered.filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date));

  return (
    <div>
      <PageHeader icon="📅" title="경제 캘린더" sub="경제지표 · 실적발표 · 배당기준일"/>

      {/* 타입 필터 */}
      <div style={{display:'flex',gap:'8px',overflowX:'auto',padding:'0 16px 14px',scrollbarWidth:'none'}}>
        {typeFilters.map(({k,l})=>(
          <button key={k} onClick={()=>setTypeFilter(k)} style={{
            flexShrink:0,padding:'8px 16px',borderRadius:'20px',
            border:`1px solid ${typeFilter===k?(EVT_COLOR[k]??'#40c4ff'):'#1a2535'}`,
            background:typeFilter===k?(EVT_COLOR[k]??'#40c4ff')+'22':'#0d1b2e',
            color:typeFilter===k?(EVT_COLOR[k]??'#40c4ff'):'#90a4ae',
            cursor:'pointer',fontSize:'13px',whiteSpace:'nowrap',fontWeight:typeFilter===k?'700':'400',
          }}>{l}</button>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div style={{margin:'0 16px 16px',background:'#0d1b2e',borderRadius:'16px',padding:'16px',border:'1px solid #1a3050'}}>
        {/* 네비게이션 */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
            <button onClick={prev} style={{background:'#1a2535',border:'none',color:'#90a4ae',cursor:'pointer',width:'36px',height:'36px',borderRadius:'50%',fontSize:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
            <span style={{fontSize:'18px',fontWeight:'700',color:'#eceff1',padding:'0 6px'}}>{yr}년 {MONTHS_KO[mo]}</span>
            <button onClick={next} style={{background:'#1a2535',border:'none',color:'#90a4ae',cursor:'pointer',width:'36px',height:'36px',borderRadius:'50%',fontSize:'20px',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
          </div>
          <button onClick={goT} style={{background:'#1a2535',border:'1px solid #40c4ff44',color:'#40c4ff',cursor:'pointer',padding:'7px 14px',borderRadius:'8px',fontSize:'13px',fontWeight:'600'}}>오늘</button>
        </div>
        {/* 요일 헤더 */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'6px'}}>
          {DAYS_KO.map((d,i)=>(
            <div key={d} style={{textAlign:'center',fontSize:'12px',fontWeight:'700',padding:'4px 0',color:i===0?'#ff5252':i===6?'#5c9eff':'#546e7a'}}>{d}</div>
          ))}
        </div>
        {/* 날짜 그리드 (크게) */}
        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
          {weeks.map((wk,wi)=>(
            <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px'}}>
              {wk.map((day,di)=>{
                if(!day) return <div key={di} style={{minHeight:'88px',background:'rgba(6,13,26,.5)',borderRadius:'8px'}}/>;
                const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isT=ds===today, isPast=ds<today;
                const dayEvs=filtered.filter(e=>e.date===ds);
                return (
                  <div key={di} style={{minHeight:'88px',background:isT?'rgba(64,196,255,.1)':isPast?'rgba(10,22,40,.5)':'#0a1628',borderRadius:'8px',padding:'5px',border:isT?'1px solid #40c4ff77':'1px solid #1a2535'}}>
                    <div style={{width:'26px',height:'26px',borderRadius:'50%',background:isT?'#40c4ff':'transparent',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px',fontSize:'13px',fontWeight:isT?'700':'500',color:isT?'#060d1a':di===0?'#ff5252':di===6?'#5c9eff':isPast?'#37474f':'#90a4ae'}}>{day}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                      {dayEvs.slice(0,3).map(ev=>{
                        const ec=EVT_COLOR[ev.type]??'#546e7a';
                        return (
                          <div key={ev.id} onClick={()=>setSel(sel?.id===ev.id?null:ev)}
                            style={{background:ec+'28',borderLeft:`2px solid ${ec}`,borderRadius:'3px',padding:'2px 4px',fontSize:'9px',color:ec,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',cursor:'pointer',lineHeight:'1.4'}}>
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvs.length>3&&<div style={{fontSize:'9px',color:'#546e7a',paddingLeft:'4px'}}>+{dayEvs.length-3}개</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* 범례 */}
        <div style={{display:'flex',gap:'10px',marginTop:'14px',flexWrap:'wrap'}}>
          {Object.entries(EVT_COLOR).map(([k,c])=>(
            <span key={k} style={{fontSize:'11px',color:'#546e7a'}}><span style={{color:c}}>■</span> {EVT_LABEL[k]}</span>
          ))}
        </div>
      </div>

      {/* 선택 이벤트 상세 */}
      {sel&&(
        <div style={{margin:'0 16px 16px',background:'#060d1a',borderRadius:'14px',padding:'18px',border:`1px solid ${EVT_COLOR[sel.type]??'#1a2535'}66`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <span style={{fontSize:'12px',padding:'4px 10px',borderRadius:'8px',background:(EVT_COLOR[sel.type]??'#546e7a')+'22',color:EVT_COLOR[sel.type]??'#546e7a',border:`1px solid ${EVT_COLOR[sel.type]??'#546e7a'}44`,fontWeight:'600'}}>{EVT_LABEL[sel.type]??sel.type}</span>
              <span style={{fontSize:'12px',color:'#546e7a'}}>{sel.date}</span>
            </div>
            <button onClick={()=>setSel(null)} style={{background:'none',border:'none',color:'#546e7a',cursor:'pointer',fontSize:'22px',padding:'0 4px'}}>×</button>
          </div>
          <div style={{fontSize:'17px',color:'#eceff1',fontWeight:'700',marginBottom:'6px'}}>{sel.title}</div>
          <div style={{fontSize:'14px',color:'#90a4ae',lineHeight:'1.5'}}>{sel.desc}</div>
          {sel.isDiv&&sel.payDate&&(
            <div style={{marginTop:'10px',background:'#ce93d822',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',color:'#ce93d8'}}>
              💜 지급일: {sel.payDate} {sel.amountUnknown&&'(금액 미확정 — 전년 기준 표기)'}
            </div>
          )}
        </div>
      )}

      {/* 다가오는 이벤트 리스트 */}
      <SectionTitle>📌 다가오는 일정</SectionTitle>
      <div style={{padding:'0 16px'}}>
        {upcoming.slice(0,20).map(ev=>{
          const ec=EVT_COLOR[ev.type]??'#546e7a';
          const d=new Date(ev.date+'T00:00:00');
          const diffDays=Math.ceil((d.getTime()-new Date(today+'T00:00:00').getTime())/(1000*60*60*24));
          const dTag=diffDays===0?'오늘':diffDays===1?'내일':`D-${diffDays}`;
          return (
            <div key={ev.id} style={{background:'#0d1b2e',borderRadius:'14px',padding:'16px',marginBottom:'10px',border:`1px solid ${ec}22`,display:'flex',gap:'14px',alignItems:'flex-start'}}
              onClick={()=>setSel(sel?.id===ev.id?null:ev)}>
              <div style={{background:ec+'22',borderRadius:'12px',padding:'8px 10px',textAlign:'center',flexShrink:0,minWidth:'48px',cursor:'pointer'}}>
                <div style={{fontSize:'12px',color:ec,fontWeight:'700'}}>{d.getMonth()+1}월</div>
                <div style={{fontSize:'22px',fontWeight:'700',color:ec,lineHeight:1}}>{d.getDate()}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'6px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'11px',padding:'3px 8px',borderRadius:'8px',background:ec+'22',color:ec,border:`1px solid ${ec}44`,fontWeight:'600'}}>{EVT_LABEL[ev.type]??ev.type}</span>
                  <span style={{fontSize:'12px',color:diffDays<=3?'#ffd740':'#546e7a',fontWeight:'600'}}>{dTag}</span>
                  {ev.imp==='high'&&<span style={{fontSize:'11px',color:'#ff5252',fontWeight:'700'}}>⬆ 고중요</span>}
                </div>
                <div style={{fontSize:'16px',color:'#eceff1',fontWeight:'600',marginBottom:'3px'}}>{ev.title}</div>
                <div style={{fontSize:'13px',color:'#546e7a'}}>{ev.desc}</div>
              </div>
            </div>
          );
        })}
        <div style={{fontSize:'12px',color:'#37474f',textAlign:'center',padding:'8px 0 16px'}}>
          ※ 배당 기준일은 사용자 종목 확정 후 업데이트 예정
        </div>
      </div>
    </div>
  );
};

// ── 📈 차트 탭 ──────────────────────────────────────────────────────
const ChartPage: React.FC<{quotes:Record<string,Quote>}> = ({quotes}) => {
  const [chartSym,setCS]=useState('NASDAQ:NVDA');
  const CHARTS=[
    ['NASDAQ:NVDA','엔비디아'],['NASDAQ:MSFT','마소'],['NYSE:LMT','록히드'],
    ['KRX:005930','삼성'],['KRX:000660','SK하이닉스'],['BINANCE:BTCUSDT','BTC'],
    ['TVC:GOLD','금'],['TVC:USOIL','WTI유'],['INDEX:SPX','S&P500'],['INDEX:NDX','나스닥'],
  ];
  return (
    <div>
      <PageHeader icon="📈" title="차트" sub="TradingView · RSI 지표 포함"/>
      {/* 종목 선택 */}
      <div style={{display:'flex',gap:'8px',overflowX:'auto',padding:'0 16px 14px',scrollbarWidth:'none'}}>
        {CHARTS.map(([s,n])=>(
          <button key={s} onClick={()=>setCS(s)} style={{
            flexShrink:0,padding:'8px 16px',borderRadius:'20px',
            border:`1px solid ${chartSym===s?'#40c4ff':'#1a2535'}`,
            background:chartSym===s?'#40c4ff22':'#0d1b2e',
            color:chartSym===s?'#40c4ff':'#90a4ae',
            cursor:'pointer',fontSize:'13px',whiteSpace:'nowrap',fontWeight:chartSym===s?'700':'400',
          }}>{n}</button>
        ))}
      </div>
      <div style={{margin:'0 16px',background:'#0d1b2e',borderRadius:'16px',overflow:'hidden',border:'1px solid #1a3050'}}>
        <TVChart sym={chartSym}/>
      </div>
      {/* 빠른 지수 요약 */}
      <SectionTitle right="yfinance">📊 지수 요약</SectionTitle>
      <div style={{padding:'0 16px'}}>
        <div style={{background:'#0d1b2e',borderRadius:'14px',border:'1px solid #1a3050',overflow:'hidden'}}>
          {IDX_META.map((m,i)=>{
            const q=quotes[m.yf];
            return (
              <div key={m.yf} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',borderBottom:i<IDX_META.length-1?'1px solid #1a2535':'none'}}>
                <div>
                  <span style={{fontSize:'13px',color:'#546e7a',marginRight:'8px'}}>{m.sym}</span>
                  <span style={{fontSize:'14px',color:'#90a4ae'}}>{m.name}</span>
                </div>
                {!q?<Spinner/>:<div style={{textAlign:'right'}}>
                  <span style={{fontSize:'15px',color:'#eceff1',fontWeight:'700'}}>{fmt(q.price)}</span>
                  <span style={{fontSize:'13px',color:clr(q.changePct),fontWeight:'700',marginLeft:'10px'}}>{q.changePct>=0?'+':''}{q.changePct.toFixed(2)}%</span>
                </div>}
              </div>
            );
          })}
        </div>
        <div style={{height:'16px'}}/>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════
type TabKey = 'market'|'news'|'analysis'|'calendar'|'chart';
const TABS: {key:TabKey;icon:string;label:string}[] = [
  {key:'market',   icon:'📊', label:'시장'},
  {key:'news',     icon:'📰', label:'뉴스'},
  {key:'analysis', icon:'🧭', label:'분석'},
  {key:'calendar', icon:'📅', label:'캘린더'},
  {key:'chart',    icon:'📈', label:'차트'},
];

export default function MobileDashboard() {
  const [tab,setTab]     = useState<TabKey>('market');
  const [mdata,setMdata] = useState<MarketData|null>(null);
  const [cryptoRT,setCR] = useState<any[]>([]);
  const [forexRT,setFR]  = useState<Record<string,number>>({});
  const [loading,setLoad]= useState(true);
  const [stale,setStale] = useState(false);
  const [nowT,setNow]    = useState(new Date());
  const scrollRef        = useRef<HTMLDivElement>(null);

  const loadStatic=useCallback(async()=>{
    try {
      const r=await fetch(`${DATA_URL}?t=${Date.now()}`);
      if(!r.ok) throw new Error(`${r.status}`);
      const d:MarketData=await r.json();
      if(!d.updatedAt) return;
      setMdata(d);setLoad(false);
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
    loadStatic();loadRT();
    setInterval(loadStatic,60_000);
    setInterval(loadRT,60_000);
  },[]);

  // 탭 전환시 스크롤 최상단
  const handleTab=(t:TabKey)=>{ setTab(t); scrollRef.current?.scrollTo({top:0,behavior:'smooth'}); };

  const quotes    = mdata?.quotes??{};
  const crypto    = cryptoRT.length?cryptoRT:(mdata?.crypto??[]);
  const rawRates  = Object.keys(forexRT).length?forexRT:(mdata?.forex??{});
  const fg        = mdata?.fearGreed??null;
  const news      = mdata?.news??[];
  const today     = new Date().toISOString().split('T')[0];
  const updTime   = mdata?.updatedAt?new Date(mdata.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):null;

  return (
    <div style={{background:'#060d1a',color:'#e0e6ed',fontFamily:"'Inter','Noto Sans KR',system-ui,sans-serif",minHeight:'100vh',maxWidth:'480px',margin:'0 auto',position:'relative',display:'flex',flexDirection:'column'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{display:none}
        button,a{font-family:'Inter','Noto Sans KR',system-ui,sans-serif}
      `}</style>

      {/* 상단 헤더 */}
      <div style={{background:'linear-gradient(135deg,#07122a,#0d1f3f)',borderBottom:'1px solid #00d4ff22',padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div>
          <div style={{fontSize:'16px',fontWeight:'700',background:'linear-gradient(90deg,#00d4ff,#00e676)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>◆ MARKET TERMINAL</div>
          <div style={{fontSize:'11px',color:'#37474f',marginTop:'2px'}}>
            {updTime?`${updTime} 기준 · 10분 갱신`:'데이터 로딩 중...'}
            {stale&&' ⚠'}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:'20px',fontWeight:'700',color:'#40c4ff',fontVariantNumeric:'tabular-nums'}}>{nowT.toLocaleTimeString('ko-KR',{hour12:false})}</div>
          <div style={{fontSize:'10px',color:'#37474f'}}>{nowT.toLocaleDateString('ko-KR')}</div>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',paddingBottom:'72px'}}>
        {loading
          ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh',gap:'16px'}}>
              <Spinner s={36}/>
              <div style={{color:'#546e7a',fontSize:'15px'}}>시장 데이터 로딩 중...</div>
              <div style={{color:'#37474f',fontSize:'12px',textAlign:'center',lineHeight:'1.6',padding:'0 32px'}}>GitHub Actions가 10분마다 최신 데이터를 수집합니다.<br/>첫 실행 후 자동으로 표시됩니다.</div>
            </div>
          : <>
              {tab==='market'   &&<MarketPage   quotes={quotes} crypto={crypto} rawRates={rawRates} fg={fg} loading={loading}/>}
              {tab==='news'     &&<NewsPage     news={news}/>}
              {tab==='analysis' &&<AnalysisPage quotes={quotes} fg={fg} loading={loading}/>}
              {tab==='calendar' &&<CalendarPage today={today}/>}
              {tab==='chart'    &&<ChartPage    quotes={quotes}/>}
            </>
        }
      </div>

      {/* 하단 탭바 */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:'480px',background:'#07122a',borderTop:'1px solid #1a2535',display:'flex',zIndex:1000,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>handleTab(t.key)} style={{
            flex:1,padding:'10px 4px 8px',background:'none',border:'none',cursor:'pointer',
            display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',
            color:tab===t.key?'#40c4ff':'#546e7a',
            borderTop:tab===t.key?'2px solid #40c4ff':'2px solid transparent',
          }}>
            <span style={{fontSize:'22px',lineHeight:1}}>{t.icon}</span>
            <span style={{fontSize:'11px',fontWeight:tab===t.key?'700':'400'}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
