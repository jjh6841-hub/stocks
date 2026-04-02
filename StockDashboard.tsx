/**
 * Market Terminal — 종합 주식 대시보드
 * ────────────────────────────────────────
 * 백엔드 없이도 동작 (CoinGecko · Open ER API 직접 호출)
 * 백엔드(FastAPI) 실행 시 WebSocket으로 자동 연결
 *
 * 사용 방법:
 *   1. 백엔드 실행: cd backend && uvicorn main:app --port 8000
 *   2. 이 파일을 React 프로젝트에 추가하고 <StockDashboard /> 렌더링
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================
// CONFIG
// ============================================================
const API_BASE = 'http://localhost:8000';
const WS_URL   = 'ws://localhost:8000/ws';
const USE_BACKEND = false; // 백엔드 실행 후 true로 변경

// 트럼프 / 핵심 키워드 (뉴스 하이라이트 + 알림)
const TRUMP_KW = ['trump','트럼프','tariff','관세','trade war','무역전쟁','white house','백악관'];
const ALERT_KW = ['fed','연준','fomc','금리','interest rate','cpi','inflation','crash','recession','경기침체','전쟁','war','nuclear','핵'];

// ============================================================
// TYPES
// ============================================================
interface IndexData { symbol:string; name:string; price:number; change:number; changePercent:number; high52w:number; low52w:number; allTimeHigh:number; }
interface CryptoData { id:string; symbol:string; name:string; current_price:number; price_change_percentage_24h:number; market_cap:number; total_volume:number; }
interface ForexItem  { pair:string; rate:number; change:number; changePercent:number; flag:string; label:string; }
interface CommodityData { name:string; symbol:string; price:number; unit:string; change:number; changePercent:number; icon:string; }
interface NewsItem { id:number; title:string; source:string; time:string; url:string; sentiment:'positive'|'negative'|'neutral'; category:string; is_trump:boolean; score:number; }
interface TrumpItem { id:string; date:string; type:'tweet'|'speech'|'policy'|'tariff'; content:string; marketReaction:string; affectedSectors:string[]; impact:'high'|'medium'|'low'; }
interface CalendarEvent { id:string; date:string; title:string; importance:'high'|'medium'|'low'; type:'fed'|'earnings'|'economic'|'options'|'geopolitical'; description?:string; country?:string; }
interface SectorData { name:string; nameKr:string; icon:string; change1d:number; change1w:number; change1m:number; hotStocks:{symbol:string;name:string;change:number;signal:'buy'|'sell'|'hold'|'watch';}[]; }
interface Alert { id:number; text:string; type:'trump'|'market'|'info'; ts:number; }

// ============================================================
// UTILS
// ============================================================
const fmt  = (n:number, d=2) => n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtCap = (n:number) => n>=1e12?`$${(n/1e12).toFixed(2)}T`:n>=1e9?`$${(n/1e9).toFixed(1)}B`:`$${(n/1e6).toFixed(0)}M`;
const clr  = (v:number)  => v>0?'#00e676':v<0?'#ff5252':'#90a4ae';
const bg   = (v:number)  => v>0?'rgba(0,230,118,.12)':v<0?'rgba(255,82,82,.12)':'rgba(144,164,174,.1)';
const flu  = (b:number, p=.001) => b*(1+(Math.random()-.5)*p);

function highlight(text:string): React.ReactNode {
  const allKw = [...TRUMP_KW, ...ALERT_KW];
  const re = new RegExp(`(${allKw.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p,i) => {
    const isTrump = TRUMP_KW.some(k=>p.toLowerCase()===k.toLowerCase());
    const isAlert = ALERT_KW.some(k=>p.toLowerCase()===k.toLowerCase());
    if(isTrump) return <mark key={i} style={{background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'0 2px',borderRadius:'2px'}}>{p}</mark>;
    if(isAlert) return <mark key={i} style={{background:'rgba(255,215,64,.15)',color:'#ffd740',padding:'0 2px',borderRadius:'2px'}}>{p}</mark>;
    return p;
  });
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

// ============================================================
// STATIC DATA
// ============================================================
const INIT_IDX:IndexData[]=[
  {symbol:'KOSPI', name:'KOSPI',    price:2481.12,change: 12.34,changePercent: 0.50,high52w:2871.56,low52w:2278.09,allTimeHigh:3316.08},
  {symbol:'KOSDAQ',name:'KOSDAQ',   price: 694.32,change: -3.21,changePercent:-0.46,high52w: 892.45,low52w: 643.21,allTimeHigh:1206.95},
  {symbol:'SPX',   name:'S&P 500',  price:5611.85,change:-89.32,changePercent:-1.57,high52w:6147.43,low52w:4953.56,allTimeHigh:6147.43},
  {symbol:'NDX',   name:'NASDAQ',   price:17299.29,change:-365.89,changePercent:-2.07,high52w:20204.58,low52w:15708.63,allTimeHigh:20204.58},
  {symbol:'DJI',   name:'DOW',      price:41870.45,change:-215.32,changePercent:-0.51,high52w:45073.63,low52w:37611.46,allTimeHigh:45073.63},
  {symbol:'N225',  name:'니케이225', price:34893.78,change: 234.56,changePercent: 0.68,high52w:42224.02,low52w:31156.12,allTimeHigh:42224.02},
  {symbol:'SSEC',  name:'상해종합',  price: 3322.45,change: -15.67,changePercent:-0.47,high52w: 3674.40,low52w: 2689.67,allTimeHigh:6124.04},
  {symbol:'DAX',   name:'DAX',      price:21987.23,change: 156.78,changePercent: 0.72,high52w:23476.80,low52w:17024.55,allTimeHigh:23476.80},
];
const INIT_COM:CommodityData[]=[
  {name:'금',     symbol:'GOLD',  price:3119.80,unit:'USD/oz',   change: 18.20,changePercent: 0.59,icon:'🥇'},
  {name:'은',     symbol:'SILVER',price:  34.12,unit:'USD/oz',   change: -0.23,changePercent:-0.67,icon:'🥈'},
  {name:'WTI원유', symbol:'WTI',  price:  71.48,unit:'USD/bbl',  change: -1.23,changePercent:-1.69,icon:'🛢️'},
  {name:'브렌트유', symbol:'BRENT',price:  75.12,unit:'USD/bbl',  change: -0.98,changePercent:-1.29,icon:'⛽'},
  {name:'천연가스', symbol:'NG',   price:   4.12,unit:'USD/MMBtu',change:  0.05,changePercent: 1.10,icon:'🔥'},
  {name:'구리',   symbol:'CU',    price:   4.89,unit:'USD/lb',   change: -0.03,changePercent:-0.69,icon:'🔶'},
];
const SECTORS:SectorData[]=[
  {name:'AI / Technology',nameKr:'AI·테크',icon:'🤖',change1d:2.3,change1w:-1.2,change1m:8.7,hotStocks:[
    {symbol:'NVDA',name:'엔비디아',change:3.21,signal:'buy'},{symbol:'MSFT',name:'마이크로소프트',change:1.45,signal:'hold'},
    {symbol:'GOOGL',name:'알파벳',change:-0.32,signal:'watch'},{symbol:'000660',name:'SK하이닉스',change:2.87,signal:'buy'},
  ]},
  {name:'Defense',nameKr:'방산',icon:'🛡️',change1d:1.8,change1w:4.2,change1m:12.3,hotStocks:[
    {symbol:'LMT',name:'록히드마틴',change:2.12,signal:'buy'},{symbol:'RTX',name:'레이시온',change:1.67,signal:'buy'},
    {symbol:'012450',name:'한화에어로',change:3.45,signal:'buy'},{symbol:'047810',name:'한국항공우주',change:2.23,signal:'watch'},
  ]},
  {name:'Semiconductor',nameKr:'반도체',icon:'💾',change1d:1.2,change1w:-0.8,change1m:5.4,hotStocks:[
    {symbol:'TSM',name:'TSMC',change:2.34,signal:'buy'},{symbol:'ASML',name:'ASML',change:1.23,signal:'buy'},
    {symbol:'005930',name:'삼성전자',change:0.89,signal:'hold'},{symbol:'AMD',name:'AMD',change:1.67,signal:'watch'},
  ]},
  {name:'Biotech',nameKr:'바이오',icon:'🧬',change1d:3.4,change1w:5.6,change1m:-2.1,hotStocks:[
    {symbol:'MRNA',name:'모더나',change:4.56,signal:'watch'},{symbol:'207940',name:'삼성바이오',change:2.34,signal:'buy'},
    {symbol:'068270',name:'셀트리온',change:1.78,signal:'hold'},{symbol:'REGN',name:'리제네론',change:-0.45,signal:'hold'},
  ]},
  {name:'Energy',nameKr:'에너지',icon:'⚡',change1d:-0.9,change1w:-2.1,change1m:-4.5,hotStocks:[
    {symbol:'XOM',name:'엑슨모빌',change:-1.23,signal:'hold'},{symbol:'CVX',name:'쉐브론',change:-0.89,signal:'hold'},
    {symbol:'096770',name:'SK이노베이션',change:-0.45,signal:'sell'},
  ]},
];
const TRUMP_UPDATES:TrumpItem[]=[
  {id:'1',date:'2026-04-02 09:23',type:'tariff',content:'전 세계 상호관세 발효 ("해방의 날"). 중국 145%, EU 20%, 한국 26% 부과. "미국이 다시 이기기 시작했다"',marketReaction:'S&P500 -2.1%, 나스닥 -2.8%, 달러 강세, 금 +0.9%',affectedSectors:['Manufacturing','Retail','Tech','Auto'],impact:'high'},
  {id:'2',date:'2026-04-01 14:45',type:'speech',content:'NATO 동맹국 국방비 GDP 5% 증액 요구. "미국이 유럽을 공짜로 지켜줄 수 없다." 방산 예산 대폭 확대 예고.',marketReaction:'방산주 급등: LMT +3.2%, RTX +2.8%, 한화에어로 +4.1%',affectedSectors:['Defense','Aerospace'],impact:'medium'},
  {id:'3',date:'2026-03-31 11:30',type:'policy',content:'AI 규제 완화 행정명령 서명. 반도체 미국 생산 인센티브 확대. 인텔 텍사스 공장 $100B 투자 유치 발표.',marketReaction:'NVDA +4.5%, INTC +3.2%, 반도체 섹터 전반 강세',affectedSectors:['Semiconductor','AI'],impact:'high'},
  {id:'4',date:'2026-03-29 08:15',type:'tweet',content:'"연준은 지금 당장 금리를 내려야 한다. 파월은 무능하다!" — Truth Social',marketReaction:'국채 금리 -8bp, 달러인덱스 -0.4%, 금 +0.6%',affectedSectors:['Financial','Real Estate'],impact:'medium'},
  {id:'5',date:'2026-03-27 16:00',type:'tariff',content:'자동차 수입 관세 25% 발표. 멕시코·캐나다·한국·일본 자동차 직격.',marketReaction:'현대차 -4.2%, 기아 -3.8%, GM +2.1%, 포드 +1.8%',affectedSectors:['Auto','Manufacturing'],impact:'high'},
];
const TRUMP_PATTERNS=[
  {trigger:'관세/무역 발언',effect:'수입소비재 -2~5%, 방산·미국제조 +1~3%',prob:'높음'},
  {trigger:'연준/파월 비판',effect:'달러 약세, 금·안전자산 강세, 국채 변동',prob:'중간'},
  {trigger:'에너지 규제 완화',effect:'석유·가스 +1~2%, 청정에너지 하락',prob:'높음'},
  {trigger:'대중국 강경 발언',effect:'반도체·기술주 변동성↑, 희토류↑',prob:'높음'},
  {trigger:'AI·반도체 투자',effect:'AI 빅테크 +2~5%, 데이터센터 수혜',prob:'높음'},
  {trigger:'우크라이나 협상',effect:'유럽 방산↓, 에너지 안정 기대, 유로↑',prob:'중간'},
];
const CALENDAR:CalendarEvent[]=[
  {id:'1', date:'2026-04-02',title:'🚨 상호관세 발효 (해방의 날)',importance:'high',type:'geopolitical',description:'트럼프 상호관세 본격 발효. 전 세계 교역국 대상',country:'US'},
  {id:'2', date:'2026-04-04',title:'🔴 美 고용보고서 (NFP)',importance:'high',type:'economic',description:'3월 비농업 고용지표. 예상: +185K',country:'US'},
  {id:'3', date:'2026-04-07',title:'FOMC 의사록 공개',importance:'high',type:'fed',country:'US'},
  {id:'4', date:'2026-04-10',title:'🔴 美 CPI 발표',importance:'high',type:'economic',description:'3월 소비자물가지수. 예상 YoY: 2.9%',country:'US'},
  {id:'5', date:'2026-04-14',title:'🔴 JPMorgan 실적',importance:'high',type:'earnings',country:'US'},
  {id:'6', date:'2026-04-14',title:'옵션 만기일',importance:'medium',type:'options',country:'US'},
  {id:'7', date:'2026-04-22',title:'🔴 TSMC 실적',importance:'high',type:'earnings',country:'TW'},
  {id:'8', date:'2026-04-23',title:'🔴 Tesla 실적',importance:'high',type:'earnings',country:'US'},
  {id:'9', date:'2026-04-25',title:'🔴 FOMC 금리 결정',importance:'high',type:'fed',description:'예상: 동결 (4.25-4.50%). 파월 기자회견',country:'US'},
  {id:'10',date:'2026-04-30',title:'🔴 美 GDP 속보치 (1Q)',importance:'high',type:'economic',country:'US'},
  {id:'11',date:'2026-04-30',title:'Microsoft 실적',importance:'high',type:'earnings',country:'US'},
  {id:'12',date:'2026-05-01',title:'🔴 Apple 실적',importance:'high',type:'earnings',country:'US'},
  {id:'13',date:'2026-05-02',title:'美 고용보고서 (4월)',importance:'high',type:'economic',country:'US'},
  {id:'14',date:'2026-05-09',title:'美-中 무역협상',importance:'high',type:'geopolitical',description:'관세 협상 타결 여부 주목',country:'US'},
];
const FALLBACK_NEWS:NewsItem[]=[
  {id:1,title:'트럼프 상호관세 발효 "해방의 날"… S&P500 선물 -2%, 아시아 시장 충격',source:'Reuters',time:'09:15',url:'#',sentiment:'negative',category:'trump',is_trump:true,score:90},
  {id:2,title:'Fed 파월 "관세가 인플레 유발할 것… 금리 인하 서두르지 않겠다"',source:'Bloomberg',time:'08:42',url:'#',sentiment:'negative',category:'macro',is_trump:false,score:70},
  {id:3,title:'NVIDIA Blackwell Ultra GPU 공개… AI 데이터센터 수요 폭증 주가 +3%',source:'CNBC',time:'07:30',url:'#',sentiment:'positive',category:'tech',is_trump:false,score:60},
  {id:4,title:'금값 사상 최고치 $3,120 돌파… 관세 충격·안전자산 수요 급증',source:'MarketWatch',time:'07:15',url:'#',sentiment:'neutral',category:'macro',is_trump:false,score:55},
  {id:5,title:'비트코인 $83,000 탈환… 기관 매수·ETF 유입 지속',source:'CoinDesk',time:'06:55',url:'#',sentiment:'positive',category:'crypto',is_trump:false,score:50},
  {id:6,title:'중국, 미국 관세에 보복 84% 관세 예고… 무역전쟁 2라운드',source:'Reuters',time:'06:30',url:'#',sentiment:'negative',category:'trump',is_trump:true,score:85},
  {id:7,title:'삼성전자 HBM4 양산 돌입… "NVIDIA·AMD에 공급 확대 협상"',source:'한국경제',time:'06:00',url:'#',sentiment:'positive',category:'korea',is_trump:false,score:45},
  {id:8,title:'WTI 원유 $71 하락… OPEC+ 증산 우려 + 글로벌 경기 침체 리스크',source:'Bloomberg',time:'05:45',url:'#',sentiment:'negative',category:'energy',is_trump:false,score:40},
];

// ============================================================
// TRADINGVIEW WIDGET
// ============================================================
const TVChart:React.FC<{symbol:string;height?:number}> = ({symbol,height=350}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    ref.current.innerHTML='';
    const container=document.createElement('div');
    container.className='tradingview-widget-container__widget';
    ref.current.appendChild(container);
    const script=document.createElement('script');
    script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async=true;
    script.innerHTML=JSON.stringify({
      symbol,interval:'D',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',
      backgroundColor:'#0d1b2e',gridColor:'rgba(30,50,80,0.3)',
      width:'100%',height,hide_top_toolbar:false,hide_legend:false,
      save_image:false,allow_symbol_change:true,
      studies:['RSI@tv-basicstudies','MACD@tv-basicstudies'],
    });
    ref.current.appendChild(script);
    return ()=>{ if(ref.current) ref.current.innerHTML=''; };
  },[symbol]);
  return <div ref={ref} style={{width:'100%',height}} />;
};

// TradingView Mini Ticker Widget
const TVMiniChart:React.FC<{symbol:string}> = ({symbol}) => {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!ref.current) return;
    ref.current.innerHTML='';
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    s.async=true;
    s.innerHTML=JSON.stringify({symbol,width:'100%',height:200,locale:'kr',dateRange:'3M',colorTheme:'dark',isTransparent:true,autosize:true,largeChartUrl:''});
    ref.current.appendChild(s);
    return ()=>{ if(ref.current) ref.current.innerHTML=''; };
  },[symbol]);
  return <div ref={ref} style={{width:'100%',height:200}} />;
};

// ============================================================
// SUB-COMPONENTS
// ============================================================
const Sparkline:React.FC<{data:number[];positive:boolean;w?:number;h?:number}> = ({data,positive,w=70,h=28}) => {
  if(data.length<2) return null;
  const min=Math.min(...data),max=Math.max(...data),range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(' ');
  return <svg width={w} height={h} style={{display:'block',overflow:'visible'}}><polyline fill="none" stroke={positive?'#00e676':'#ff5252'} strokeWidth="1.5" points={pts}/></svg>;
};

const FearGreed:React.FC<{value:number}> = ({value}) => {
  const v=Math.max(0,Math.min(100,value));
  const zones=[{color:'#ff1744',label:'극도의 공포',max:20},{color:'#ff6d00',label:'공포',max:40},{color:'#ffd740',label:'중립',max:60},{color:'#b2ff59',label:'탐욕',max:80},{color:'#00e676',label:'극도의 탐욕',max:100}];
  const zone=zones.find(z=>v<=z.max)??zones[4];
  const rad=((v/100)*180-90)*Math.PI/180;
  const cx=75,cy=70,r=55;
  return (
    <div style={{textAlign:'center'}}>
      <svg width={150} height={88} viewBox="0 0 150 88">
        {zones.map((z,i)=>{
          const a0=(i/zones.length)*Math.PI, a1=((i+1)/zones.length)*Math.PI;
          const r1=55,r2=38;
          const x1=cx-r1*Math.cos(a0),y1=cy-r1*Math.sin(a0);
          const x2=cx-r2*Math.cos(a0),y2=cy-r2*Math.sin(a0);
          const x3=cx-r2*Math.cos(a1),y3=cy-r2*Math.sin(a1);
          const x4=cx-r1*Math.cos(a1),y4=cy-r1*Math.sin(a1);
          return <path key={i} d={`M ${x1} ${y1} A ${r1} ${r1} 0 0 1 ${x4} ${y4} L ${x3} ${y3} A ${r2} ${r2} 0 0 0 ${x2} ${y2} Z`} fill={z.color} opacity={0.35}/>;
        })}
        <line x1={cx} y1={cy} x2={cx+r*Math.sin(rad)} y2={cy-r*Math.cos(rad)} stroke={zone.color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={5} fill={zone.color}/>
        <text x={cx} y={cy-14} textAnchor="middle" fill={zone.color} fontSize="18" fontWeight="bold">{v}</text>
      </svg>
      <div style={{color:zone.color,fontWeight:'bold',fontSize:'12px',marginTop:'-2px'}}>{zone.label}</div>
      <div style={{color:'#546e7a',fontSize:'10px'}}>공포&탐욕 지수</div>
    </div>
  );
};

const IdxCard:React.FC<{data:IndexData;spark:number[]}> = ({data,spark}) => {
  const pos=data.changePercent>=0,c=clr(data.changePercent);
  const pct52=((data.price-data.low52w)/(data.high52w-data.low52w))*100;
  const fromATH=((data.allTimeHigh-data.price)/data.allTimeHigh*100);
  const zone=pct52<20?'🟢 기회구간':pct52>80?'🔴 고점권':'🟡 중간권';
  return (
    <div style={{background:'#0d1b2e',border:`1px solid #1a3050`,borderLeft:`3px solid ${c}`,borderRadius:'8px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
        <div><div style={{fontSize:'10px',color:'#546e7a',letterSpacing:'1px'}}>{data.symbol}</div><div style={{fontSize:'12px',color:'#90a4ae'}}>{data.name}</div></div>
        <Sparkline data={spark} positive={pos}/>
      </div>
      <div style={{fontSize:'20px',fontWeight:'bold',color:'#eceff1',marginBottom:'4px'}}>{fmt(data.price)}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <span style={{background:bg(data.changePercent),color:c,padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:'bold'}}>
          {pos?'▲':'▼'} {Math.abs(data.changePercent).toFixed(2)}%
        </span>
        <span style={{fontSize:'10px',color:'#546e7a'}}>{pos?'+':''}{fmt(data.change)}</span>
      </div>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:'9px',color:'#37474f',marginBottom:'2px'}}>
          <span>52W 저점</span>
          <span style={{color:pct52<20?'#00e676':pct52>80?'#ff5252':'#546e7a'}}>{zone}</span>
          <span>ATH -{fromATH.toFixed(1)}%</span>
        </div>
        <div style={{background:'#1a2535',height:'5px',borderRadius:'3px',position:'relative'}}>
          <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${Math.min(100,Math.max(0,pct52))}%`,background:pct52<20?'#00e676':pct52>80?'#ff5252':'#40c4ff',borderRadius:'3px',transition:'width .5s'}}/>
        </div>
      </div>
    </div>
  );
};

const SIG={buy:'#00e676',sell:'#ff5252',hold:'#ffd740',watch:'#40c4ff'};
const SIGL={buy:'매수',sell:'매도',hold:'보유',watch:'관망'};
const SecCard:React.FC<{s:SectorData}> = ({s}) => (
  <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
      <div><span style={{fontSize:'15px'}}>{s.icon}</span><span style={{fontWeight:'bold',color:'#eceff1',fontSize:'13px',marginLeft:'6px'}}>{s.nameKr}</span><span style={{color:'#37474f',fontSize:'10px',marginLeft:'6px'}}>{s.name}</span></div>
      <div style={{display:'flex',gap:'8px',fontSize:'11px'}}>
        <span style={{color:clr(s.change1d)}}>{s.change1d>0?'+':''}{s.change1d.toFixed(1)}%</span>
        <span style={{color:clr(s.change1w),opacity:.8}}>1주 {s.change1w>0?'+':''}{s.change1w.toFixed(1)}%</span>
        <span style={{color:clr(s.change1m),opacity:.6}}>1월 {s.change1m>0?'+':''}{s.change1m.toFixed(1)}%</span>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px'}}>
      {s.hotStocks.map(st=>(
        <div key={st.symbol} style={{background:'#0a1628',borderRadius:'6px',padding:'5px 8px',display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${SIG[st.signal]}22`}}>
          <div><div style={{fontSize:'10px',color:'#546e7a'}}>{st.symbol}</div><div style={{fontSize:'11px',color:'#b0bec5'}}>{st.name}</div></div>
          <div style={{textAlign:'right'}}>
            <div style={{color:clr(st.change),fontSize:'11px',fontWeight:'bold'}}>{st.change>0?'+':''}{st.change.toFixed(2)}%</div>
            <div style={{background:SIG[st.signal]+'22',color:SIG[st.signal],fontSize:'9px',padding:'1px 5px',borderRadius:'3px',border:`1px solid ${SIG[st.signal]}44`}}>{SIGL[st.signal]}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TC={tweet:'#1e88e5',speech:'#ffd740',policy:'#00e676',tariff:'#ff5252'};
const TL={tweet:'소셜미디어',speech:'연설',policy:'정책서명',tariff:'관세'};
const IC={high:'#ff5252',medium:'#ffd740',low:'#00e676'};
const TrumpCard:React.FC<{item:TrumpItem}> = ({item}) => (
  <div style={{background:'#0d1b2e',border:`1px solid ${TC[item.type]}33`,borderLeft:`3px solid ${TC[item.type]}`,borderRadius:'8px',padding:'12px',marginBottom:'10px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',flexWrap:'wrap',gap:'4px'}}>
      <div style={{display:'flex',gap:'6px'}}>
        <span style={{background:TC[item.type]+'22',color:TC[item.type],padding:'2px 8px',borderRadius:'4px',fontSize:'10px',border:`1px solid ${TC[item.type]}44`}}>{TL[item.type]}</span>
        <span style={{background:IC[item.impact]+'22',color:IC[item.impact],padding:'2px 8px',borderRadius:'4px',fontSize:'10px'}}>
          {item.impact==='high'?'🔴 고충격':item.impact==='medium'?'🟡 중충격':'🟢 저충격'}
        </span>
      </div>
      <span style={{color:'#37474f',fontSize:'10px'}}>{item.date}</span>
    </div>
    <p style={{color:'#cfd8dc',fontSize:'12px',lineHeight:'1.6',margin:'0 0 8px 0'}}>{highlight(item.content)}</p>
    <div style={{background:'#080e1a',borderRadius:'6px',padding:'8px',marginBottom:'8px'}}>
      <div style={{fontSize:'10px',color:'#546e7a',marginBottom:'3px'}}>📈 시장 반응</div>
      <div style={{fontSize:'11px',color:'#90a4ae'}}>{item.marketReaction}</div>
    </div>
    <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
      {item.affectedSectors.map(s=><span key={s} style={{background:'#1a2535',color:'#546e7a',padding:'2px 6px',borderRadius:'3px',fontSize:'10px'}}>{s}</span>)}
    </div>
  </div>
);

const ETC={fed:'#ffd740',earnings:'#40c4ff',economic:'#00e676',options:'#ff9100',geopolitical:'#ff5252'};
const ETL={fed:'Fed',earnings:'실적',economic:'경제지표',options:'옵션',geopolitical:'지정학'};
const CalItem:React.FC<{ev:CalendarEvent;today:string}> = ({ev,today}) => {
  const isT=ev.date===today; const d=new Date(ev.date);
  return (
    <div style={{display:'flex',gap:'10px',alignItems:'flex-start',padding:'7px 8px',borderRadius:'6px',marginBottom:'3px',background:isT?'#0a1f3d':'transparent',border:isT?'1px solid #00d4ff44':'1px solid transparent'}}>
      <div style={{minWidth:'34px',textAlign:'center',background:isT?'#00d4ff22':'#1a2535',borderRadius:'6px',padding:'3px'}}>
        <div style={{fontSize:'9px',color:'#546e7a'}}>{d.getMonth()+1}월</div>
        <div style={{fontSize:'16px',fontWeight:'bold',lineHeight:1,color:isT?'#40c4ff':'#eceff1'}}>{d.getDate()}</div>
      </div>
      <div style={{flex:1}}>
        <div style={{display:'flex',gap:'4px',alignItems:'center',marginBottom:'3px',flexWrap:'wrap'}}>
          <span style={{fontSize:'9px',padding:'1px 5px',borderRadius:'3px',background:ETC[ev.type]+'22',color:ETC[ev.type],border:`1px solid ${ETC[ev.type]}44`}}>{ETL[ev.type]}</span>
          <span style={{fontSize:'9px',color:IC[ev.importance]}}>{'●'.repeat(ev.importance==='high'?3:ev.importance==='medium'?2:1)}</span>
          {ev.country&&<span style={{fontSize:'9px',color:'#37474f'}}>{ev.country}</span>}
        </div>
        <div style={{fontSize:'12px',color:'#cfd8dc',fontWeight:ev.importance==='high'?'bold':'normal'}}>{ev.title}</div>
        {ev.description&&<div style={{fontSize:'10px',color:'#37474f',marginTop:'2px'}}>{ev.description}</div>}
      </div>
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function StockDashboard() {
  const [nowTime,setNowTime]   = useState(new Date());
  const [indices,setIndices]   = useState<IndexData[]>(INIT_IDX);
  const [comods,setComods]     = useState<CommodityData[]>(INIT_COM);
  const [crypto,setCrypto]     = useState<CryptoData[]>([]);
  const [cryptoLoading,setCL]  = useState(true);
  const [rates,setRates]       = useState<Record<string,number>>({KRW:1457.5,EUR:.922,JPY:149.8,CNY:7.23,GBP:.789});
  const [fearGreed,setFG]      = useState(32);
  const [vix,setVix]           = useState(24.8);
  const [news,setNews]         = useState<NewsItem[]>(FALLBACK_NEWS);
  const [newsLoading,setNL]    = useState(false);
  const [spark,setSpark]       = useState<Record<string,number[]>>({});
  const [tab,setTab]           = useState<'news'|'trump'|'calendar'|'chart'>('news');
  const [chartSym,setChartSym] = useState('NASDAQ:NVDA');
  const [newsFilter,setNF]     = useState('all');
  const [alerts,setAlerts]     = useState<Alert[]>([]);
  const [wsStatus,setWsStatus] = useState<'connected'|'disconnected'|'disabled'>('disabled');
  const [lastUpd,setLastUpd]   = useState(new Date());
  const [refreshing,setRef]    = useState(false);
  const wsRef = useRef<WebSocket|null>(null);

  // sparkline 초기화
  useEffect(()=>{
    const d:Record<string,number[]>={};
    INIT_IDX.forEach(idx=>{ let v=idx.price*.97; const pts:number[]=[]; for(let i=0;i<24;i++){v=flu(v,.012);pts.push(v);} pts[pts.length-1]=idx.price; d[idx.symbol]=pts; });
    setSpark(d);
  },[]);

  // 시계
  useEffect(()=>{ const t=setInterval(()=>setNowTime(new Date()),1000); return()=>clearInterval(t); },[]);

  // 알림 추가
  const addAlert = useCallback((text:string,type:Alert['type'])=>{
    setAlerts(p=>[{id:Date.now(),text,type,ts:Date.now()},...p].slice(0,5));
  },[]);

  // 암호화폐 가져오기 (CoinGecko - 무료)
  const fetchCrypto = useCallback(async()=>{
    try {
      const r=await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,binancecoin&order=market_cap_desc&sparkline=false&price_change_percentage=24h');
      if(r.ok){ const d=await r.json(); setCrypto(d); }
      else throw new Error();
    } catch {
      setCrypto([
        {id:'bitcoin',    symbol:'btc',name:'Bitcoin', current_price:83241,price_change_percentage_24h: 1.23,market_cap:1648e9,total_volume:42e9},
        {id:'ethereum',   symbol:'eth',name:'Ethereum',current_price:1823, price_change_percentage_24h:-0.87,market_cap:219e9, total_volume:18e9},
        {id:'solana',     symbol:'sol',name:'Solana',  current_price:124.5,price_change_percentage_24h: 2.34,market_cap:64e9,  total_volume:4.2e9},
        {id:'ripple',     symbol:'xrp',name:'XRP',     current_price:2.14, price_change_percentage_24h:-1.23,market_cap:123e9, total_volume:6.8e9},
        {id:'binancecoin',symbol:'bnb',name:'BNB',     current_price:596,  price_change_percentage_24h: 0.56,market_cap:86e9,  total_volume:2.1e9},
      ]);
    }
    setCL(false);
  },[]);

  // 환율 가져오기 (Open ER API - 무료)
  const fetchRates = useCallback(async()=>{
    try {
      const r=await fetch('https://open.er-api.com/v6/latest/USD');
      if(r.ok){ const d=await r.json(); setRates(d.rates??rates); }
    } catch {}
  },[]);

  // 뉴스 가져오기
  const fetchNews = useCallback(async()=>{
    setNL(true);
    if(USE_BACKEND){
      try {
        const r=await fetch(`${API_BASE}/api/news`);
        if(r.ok){ const d=await r.json(); setNews(d); }
      } catch {}
    }
    // RSS는 백엔드를 통해서만 CORS 없이 가능
    // 직접 접근 시 FALLBACK_NEWS 사용
    setNL(false);
  },[]);

  // WebSocket 연결 (백엔드 실행 시)
  useEffect(()=>{
    if(!USE_BACKEND){ setWsStatus('disabled'); return; }
    const connect=()=>{
      const ws=new WebSocket(WS_URL);
      wsRef.current=ws;
      ws.onopen=()=>{ setWsStatus('connected'); addAlert('백엔드 WebSocket 연결됨','info'); };
      ws.onmessage=e=>{
        const d=JSON.parse(e.data);
        if(d.crypto) setCrypto(d.crypto);
        if(d.forex)  setRates(d.forex);
        if(d.fearGreed) setFG(d.fearGreed.value??32);
        if(d.trump_alerts?.length){
          d.trump_alerts.forEach((n:NewsItem)=>addAlert(`🎭 ${n.title.slice(0,60)}…`,'trump'));
        }
        setLastUpd(new Date());
      };
      ws.onclose=()=>{ setWsStatus('disconnected'); setTimeout(connect,5000); };
      ws.onerror=()=>ws.close();
    };
    connect();
    return()=>{ wsRef.current?.close(); };
  },[]);

  // 라이브 시뮬레이션 (주가 미세 변동)
  const simulate=useCallback(()=>{
    setIndices(p=>p.map(i=>({...i,price:flu(i.price,.0008)})));
    setComods(p=>p.map(c=>({...c,price:flu(c.price,.0006)})));
    setFG(p=>Math.max(10,Math.min(90,p+(Math.random()-.5)*1.2)));
    setVix(p=>Math.max(12,Math.min(55,p+(Math.random()-.5)*.4)));
    setSpark(p=>{
      const n={...p};
      Object.keys(n).forEach(k=>{
        const a=[...n[k]]; a.shift(); a.push(flu(a[a.length-1],.008)); n[k]=a;
      });
      return n;
    });
  },[]);

  useEffect(()=>{
    fetchCrypto(); fetchRates(); fetchNews();
    const live=setInterval(simulate,4000);
    const apiT=setInterval(async()=>{
      setRef(true);
      await Promise.all([fetchCrypto(),fetchRates()]);
      setLastUpd(new Date());
      setTimeout(()=>setRef(false),600);
    },30000);
    const newsT=setInterval(fetchNews,300000); // 5분마다 뉴스 새로고침
    return()=>{ clearInterval(live); clearInterval(apiT); clearInterval(newsT); };
  },[]);

  const ms=getMarketStatus();
  const today=new Date().toISOString().split('T')[0];
  const usdKrw=rates.KRW??1457.5;
  const forex:ForexItem[]=[
    {pair:'USD/KRW',rate:usdKrw,                                          change:-8.5, changePercent:-0.58,flag:'🇺🇸',label:'달러/원'},
    {pair:'EUR/KRW',rate:rates.KRW&&rates.EUR?rates.KRW/rates.EUR:1582,   change:12.3, changePercent: 0.78,flag:'🇪🇺',label:'유로/원'},
    {pair:'JPY/KRW',rate:rates.KRW&&rates.JPY?(rates.KRW/rates.JPY)*100:973,change:-2.1,changePercent:-0.22,flag:'🇯🇵',label:'100엔/원'},
    {pair:'CNY/KRW',rate:rates.KRW&&rates.CNY?rates.KRW/rates.CNY:201,    change:-1.8, changePercent:-0.89,flag:'🇨🇳',label:'위안/원'},
    {pair:'GBP/KRW',rate:rates.KRW&&rates.GBP?rates.KRW/rates.GBP:1849,   change: 5.4, changePercent: 0.29,flag:'🇬🇧',label:'파운드/원'},
  ];
  const filteredNews=newsFilter==='all'?news:newsFilter==='trump'?news.filter(n=>n.is_trump):news.filter(n=>n.category===newsFilter);
  const upcoming=CALENDAR.filter(e=>e.date>=today).slice(0,15);

  const tabBtn=(k:typeof tab,l:string):React.CSSProperties => ({
    padding:'8px 14px',border:'none',cursor:'pointer',fontSize:'12px',fontFamily:'inherit',
    borderBottom:tab===k?'2px solid #40c4ff':'2px solid transparent',
    background:'transparent',color:tab===k?'#40c4ff':'#546e7a',
    fontWeight:tab===k?'bold':'normal',transition:'all .2s',
  });
  const fBtn=(k:string,l:string) => (
    <button key={k} onClick={()=>setNF(k)} style={{padding:'3px 10px',borderRadius:'4px',border:`1px solid ${newsFilter===k?'#40c4ff':'#1a2535'}`,background:newsFilter===k?'#40c4ff22':'transparent',color:newsFilter===k?'#40c4ff':'#546e7a',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>{l}</button>
  );

  const WS_CHART_SYMBOLS=[
    ['NASDAQ:NVDA','엔비디아'],['NASDAQ:MSFT','마이크로소프트'],['NYSE:LMT','록히드마틴'],
    ['KRX:005930','삼성전자'],['KRX:000660','SK하이닉스'],['BINANCE:BTCUSDT','비트코인'],
    ['TVC:GOLD','금'],['TVC:USOIL','WTI원유'],['INDEX:SPX','S&P500'],['INDEX:NQ1!','나스닥'],
  ];

  return (
    <div style={{background:'#060d1a',color:'#e0e6ed',fontFamily:"'Courier New','Nanum Gothic Coding',Consolas,monospace",minHeight:'100vh',margin:0,padding:0}}>
      <style>{`
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeOut{from{opacity:1}to{opacity:0}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#1a2535 #060d1a}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#060d1a}
        ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:3px}
      `}</style>

      {/* HEADER */}
      <div style={{background:'linear-gradient(135deg,#07122a 0%,#0d1f3f 100%)',borderBottom:'2px solid #00d4ff33',padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:1000,boxShadow:'0 4px 24px rgba(0,212,255,.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <div style={{fontSize:'17px',fontWeight:'bold',background:'linear-gradient(90deg,#00d4ff,#00e676)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>◆ MARKET TERMINAL</div>
          <div style={{fontSize:'10px',color:'#37474f',letterSpacing:'2px'}}>실시간 종합 시장 대시보드</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'14px',fontSize:'11px'}}>
          {/* 데이터 소스 상태 */}
          <div style={{display:'flex',gap:'6px',fontSize:'9px'}}>
            <span style={{background:'#00e67622',color:'#00e676',padding:'2px 6px',borderRadius:'3px'}}>₿ CoinGecko Live</span>
            <span style={{background:'#00e67622',color:'#00e676',padding:'2px 6px',borderRadius:'3px'}}>💱 ER-API Live</span>
            <span style={{background:wsStatus==='connected'?'#00e67622':wsStatus==='disabled'?'#1a2535':'#ff525222',color:wsStatus==='connected'?'#00e676':wsStatus==='disabled'?'#546e7a':'#ff5252',padding:'2px 6px',borderRadius:'3px'}}>
              {wsStatus==='connected'?'🔌 WS연결됨':wsStatus==='disabled'?'🔌 WS미사용':'🔌 WS끊김'}
            </span>
          </div>
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{background:ms.usStatus==='개장중'?'#00e67622':'#ff525222',border:`1px solid ${ms.usColor}44`,color:ms.usColor,padding:'3px 10px',borderRadius:'4px'}}>🇺🇸 US {ms.usStatus}</span>
            <span style={{background:ms.krStatus==='개장중'?'#00e67622':'#1a2535',color:ms.krStatus==='개장중'?'#00e676':'#546e7a',padding:'3px 10px',borderRadius:'4px'}}>🇰🇷 KR {ms.krStatus}</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:'bold',fontSize:'15px',color:'#40c4ff',fontFamily:'monospace'}}>{nowTime.toLocaleTimeString('ko-KR',{hour12:false})}</div>
            <div style={{fontSize:'9px',color:'#37474f'}}>KST · {nowTime.toLocaleDateString('ko-KR')}</div>
          </div>
          <div style={{fontSize:'10px',color:'#37474f',display:'flex',alignItems:'center',gap:'4px'}}>
            <span style={{display:'inline-block',animation:refreshing?'spin .8s linear infinite':'none',color:'#40c4ff'}}>⟳</span>
            {lastUpd.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}
          </div>
        </div>
      </div>

      {/* ALERT BANNER */}
      {alerts.length>0 && (
        <div style={{position:'fixed',top:'60px',right:'16px',zIndex:2000,display:'flex',flexDirection:'column',gap:'6px'}}>
          {alerts.map(a=>(
            <div key={a.id} style={{background:a.type==='trump'?'#1a0808':a.type==='market'?'#0a1a0a':'#0a1220',border:`1px solid ${a.type==='trump'?'#ff5252':a.type==='market'?'#00e676':'#40c4ff'}`,borderRadius:'8px',padding:'8px 12px',maxWidth:'320px',fontSize:'11px',color:'#cfd8dc',animation:'slideIn .3s ease',boxShadow:'0 4px 12px rgba(0,0,0,.5)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
                <div>{a.text}</div>
                <button onClick={()=>setAlerts(p=>p.filter(x=>x.id!==a.id))} style={{background:'none',border:'none',color:'#546e7a',cursor:'pointer',fontSize:'14px',padding:'0',lineHeight:1}}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TICKER TAPE */}
      <div style={{background:'#040a14',borderBottom:'1px solid #1a2535',padding:'5px 0',overflow:'hidden',whiteSpace:'nowrap'}}>
        <div style={{display:'inline-block',animation:'ticker 50s linear infinite'}}>
          {[...INIT_IDX,...INIT_COM,...INIT_IDX,...INIT_COM].map((item,i)=>{
            const isIdx='allTimeHigh' in item;
            const pct=isIdx?(item as IndexData).changePercent:(item as CommodityData).changePercent;
            const sym=isIdx?(item as IndexData).symbol:(item as CommodityData).symbol;
            const price=isIdx?(item as IndexData).price:(item as CommodityData).price;
            return <span key={i} style={{marginRight:'36px',fontSize:'11px'}}><span style={{color:'#546e7a'}}>{sym} </span><span style={{color:'#eceff1'}}>{fmt(price)} </span><span style={{color:clr(pct)}}>{pct>0?'▲':'▼'}{Math.abs(pct).toFixed(2)}%</span></span>;
          })}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{padding:'14px 16px',maxWidth:'1900px',margin:'0 auto'}}>

        {/* ROW 1: Indices */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>📊 주요 지수 <span style={{fontSize:'9px',color:'#546e7a',letterSpacing:'0'}}>· 52주 저점/고점 대비 위치 포함</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
            {indices.map(idx=><IdxCard key={idx.symbol} data={idx} spark={spark[idx.symbol]??[idx.price]}/>)}
          </div>
        </div>

        {/* ROW 2: Sidebar + Tabs */}
        <div style={{display:'grid',gridTemplateColumns:'230px 1fr',gap:'14px',marginBottom:'14px'}}>

          {/* Sidebar */}
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {/* Fear & Greed */}
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px',textAlign:'center'}}>
              <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>🧠 시장 심리</div>
              <FearGreed value={Math.round(fearGreed)}/>
              <div style={{borderTop:'1px solid #1a2535',marginTop:'10px',paddingTop:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'11px',color:'#546e7a'}}>VIX (변동성)</span>
                  <span style={{fontSize:'14px',fontWeight:'bold',color:vix>30?'#ff5252':vix>20?'#ffd740':'#00e676'}}>{vix.toFixed(1)}</span>
                </div>
                <div style={{fontSize:'9px',color:'#37474f',marginTop:'6px',textAlign:'left',lineHeight:'1.7'}}>
                  <div style={{color:vix<15?'#00e676':'#37474f'}}>• &lt;15 매우 낮은 변동성</div>
                  <div style={{color:vix>=15&&vix<20?'#b2ff59':'#37474f'}}>• 15-20 정상</div>
                  <div style={{color:vix>=20&&vix<30?'#ffd740':'#37474f'}}>• 20-30 높은 불안</div>
                  <div style={{color:vix>=30?'#ff5252':'#37474f'}}>• &gt;30 극도의 공포</div>
                </div>
              </div>
            </div>

            {/* 역사적 위치 */}
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
              <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>📏 역사적 위치 & 기회구간</div>
              {[
                {name:'S&P500', cur:indices[2]?.price??5611, lo:4953, hi:6147, ath:6147},
                {name:'KOSPI',  cur:indices[0]?.price??2481, lo:2278, hi:2871, ath:3316},
                {name:'금(Gold)',cur:comods[0]?.price??3119, lo:1970, hi:3169, ath:3169},
                {name:'BTC',    cur:crypto[0]?.current_price??83241, lo:49500, hi:109350, ath:109350},
              ].map(it=>{
                const pct=((it.cur-it.lo)/(it.hi-it.lo))*100;
                const fromATH=((it.ath-it.cur)/it.ath*100);
                const zone=pct<20?'🟢 기회구간':pct>80?'🔴 고점권':pct>60?'🟡 주의권':'🔵 중간권';
                return (
                  <div key={it.name} style={{marginBottom:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:'10px',marginBottom:'3px'}}>
                      <span style={{color:'#90a4ae'}}>{it.name}</span>
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

          {/* Main Tabs */}
          <div>
            <div style={{display:'flex',borderBottom:'1px solid #1a2535',marginBottom:'12px'}}>
              <button style={tabBtn('news','news')} onClick={()=>setTab('news')}>📰 주요 뉴스</button>
              <button style={tabBtn('trump','trump')} onClick={()=>setTab('trump')}>🎭 트럼프 모니터</button>
              <button style={tabBtn('calendar','calendar')} onClick={()=>setTab('calendar')}>📅 경제 캘린더</button>
              <button style={tabBtn('chart','chart')} onClick={()=>setTab('chart')}>📈 TradingView 차트</button>
            </div>

            {/* NEWS */}
            {tab==='news'&&(
              <div>
                <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap',alignItems:'center'}}>
                  {[['all','전체'],['trump','🎭 트럼프'],['macro','🌐 매크로'],['tech','💻 테크'],['crypto','₿ 코인'],['korea','🇰🇷 한국'],['energy','⛽ 에너지'],['earnings','📊 실적']].map(([k,l])=>fBtn(k,l))}
                  {newsLoading&&<span style={{fontSize:'10px',color:'#546e7a',marginLeft:'auto'}}>뉴스 업데이트 중...</span>}
                  <span style={{fontSize:'9px',color:'#37474f',marginLeft:'auto'}}>5분마다 자동 갱신 | <span style={{color:'#ff8a80'}}>■</span> 트럼프 <span style={{color:'#ffd740'}}>■</span> 핵심키워드 하이라이트</span>
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px',maxHeight:'430px',overflowY:'auto'}}>
                  {filteredNews.map(item=>{
                    const SC={positive:'#00e676',negative:'#ff5252',neutral:'#ffd740'};
                    const SI={positive:'↑ 호재',negative:'↓ 악재',neutral:'→ 중립'};
                    return (
                      <div key={item.id} style={{borderBottom:'1px solid #1a2535',paddingBottom:'10px',marginBottom:'10px',background:item.is_trump?'rgba(255,82,82,.03)':'transparent',borderRadius:'4px',padding:'6px'}}>
                        <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'5px',flexWrap:'wrap'}}>
                          {item.is_trump&&<span style={{fontSize:'9px',background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'1px 5px',borderRadius:'3px',border:'1px solid rgba(255,82,82,.3)'}}>🎭 트럼프</span>}
                          <span style={{fontSize:'9px',color:SC[item.sentiment],background:SC[item.sentiment]+'22',padding:'1px 5px',borderRadius:'3px'}}>{SI[item.sentiment]}</span>
                          <span style={{fontSize:'9px',color:'#37474f',marginLeft:'auto'}}>{item.source} · {item.time}</span>
                        </div>
                        <div style={{fontSize:'12px',color:'#cfd8dc',lineHeight:'1.5',cursor:'pointer'}}
                          onMouseEnter={e=>((e.target as HTMLElement).style.color='#40c4ff')}
                          onMouseLeave={e=>((e.target as HTMLElement).style.color='#cfd8dc')}>
                          {highlight(item.title)}
                        </div>
                      </div>
                    );
                  })}
                  {filteredNews.length===0&&<div style={{textAlign:'center',color:'#37474f',padding:'40px',fontSize:'12px'}}>해당 카테고리 뉴스가 없습니다</div>}
                </div>
              </div>
            )}

            {/* TRUMP */}
            {tab==='trump'&&(
              <div>
                <div style={{background:'#120808',border:'1px solid #ff525233',borderRadius:'8px',padding:'12px',marginBottom:'12px'}}>
                  <div style={{fontSize:'11px',color:'#ff8a80',fontWeight:'bold',marginBottom:'8px'}}>🎭 트럼프 발언 패턴 — 시장 영향 분석</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'6px'}}>
                    {TRUMP_PATTERNS.map((p,i)=>(
                      <div key={i} style={{background:'#0d0707',borderRadius:'6px',padding:'7px 9px',fontSize:'10px'}}>
                        <div style={{color:'#ff8a80',fontWeight:'bold',marginBottom:'3px'}}>📌 {p.trigger}</div>
                        <div style={{color:'#90a4ae',lineHeight:'1.4',marginBottom:'3px'}}>{p.effect}</div>
                        <div style={{color:p.prob==='높음'?'#ff5252':'#ffd740',fontSize:'9px'}}>확률: {p.prob}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{maxHeight:'330px',overflowY:'auto'}}>
                  {TRUMP_UPDATES.map(item=><TrumpCard key={item.id} item={item}/>)}
                </div>
              </div>
            )}

            {/* CALENDAR */}
            {tab==='calendar'&&(
              <div>
                <div style={{display:'flex',gap:'10px',fontSize:'10px',color:'#37474f',marginBottom:'8px',flexWrap:'wrap'}}>
                  <span><span style={{color:'#ffd740'}}>■</span> Fed/연준</span>
                  <span><span style={{color:'#40c4ff'}}>■</span> 실적</span>
                  <span><span style={{color:'#00e676'}}>■</span> 경제지표</span>
                  <span><span style={{color:'#ff9100'}}>■</span> 옵션만기</span>
                  <span><span style={{color:'#ff5252'}}>■</span> 지정학</span>
                  <span style={{marginLeft:'auto'}}><span style={{color:'#ff5252'}}>●●●</span> 고중요 <span style={{color:'#ffd740'}}>●●</span> 중 <span style={{color:'#00e676'}}>●</span> 낮음</span>
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'10px',maxHeight:'440px',overflowY:'auto'}}>
                  {upcoming.map(ev=><CalItem key={ev.id} ev={ev} today={today}/>)}
                </div>
              </div>
            )}

            {/* TRADINGVIEW CHART */}
            {tab==='chart'&&(
              <div>
                <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap'}}>
                  {WS_CHART_SYMBOLS.map(([sym,name])=>(
                    <button key={sym} onClick={()=>setChartSym(sym)} style={{padding:'4px 10px',borderRadius:'4px',border:`1px solid ${chartSym===sym?'#40c4ff':'#1a2535'}`,background:chartSym===sym?'#40c4ff22':'transparent',color:chartSym===sym?'#40c4ff':'#546e7a',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>
                      {name}
                    </button>
                  ))}
                </div>
                <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',overflow:'hidden'}}>
                  <TVChart symbol={chartSym} height={420}/>
                </div>
                <div style={{fontSize:'10px',color:'#37474f',marginTop:'6px',textAlign:'center'}}>
                  TradingView 무료 위젯 · RSI·MACD 포함 · 실시간 차트
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 3: Hot Sectors */}
        <div style={{marginBottom:'14px'}}>
          <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'10px'}}>🔥 핫 섹터 &amp; 주요 종목 <span style={{fontSize:'9px',color:'#546e7a',letterSpacing:'0'}}>· 매수/매도/관망 시그널 포함</span></div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            {SECTORS.slice(0,3).map(s=><SecCard key={s.name} s={s}/>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'10px'}}>
            {SECTORS.slice(3).map(s=><SecCard key={s.name} s={s}/>)}
          </div>
        </div>

        {/* ROW 4: Crypto + Forex + Commodities */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'14px',marginBottom:'14px'}}>

          {/* Crypto */}
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>
              ₿ 암호화폐 <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● CoinGecko 실시간</span>
              {cryptoLoading&&<span style={{fontSize:'9px',color:'#546e7a',marginLeft:'8px'}}>로딩중...</span>}
            </div>
            {crypto.map(c=>(
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'30px',height:'30px',borderRadius:'50%',background:'#1a2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',color:'#ffd740',fontWeight:'bold'}}>
                    {c.symbol.toUpperCase().slice(0,2)}
                  </div>
                  <div>
                    <div style={{fontSize:'12px',color:'#eceff1',fontWeight:'bold'}}>{c.name}</div>
                    <div style={{fontSize:'10px',color:'#37474f'}}>{fmtCap(c.market_cap)}</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px',color:'#f1f5f9',fontWeight:'bold'}}>${c.current_price.toLocaleString()}</div>
                  <div style={{fontSize:'11px',color:clr(c.price_change_percentage_24h),fontWeight:'bold'}}>
                    {c.price_change_percentage_24h>0?'▲':'▼'} {Math.abs(c.price_change_percentage_24h).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Forex */}
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>
              💱 환율 (원화 기준) <span style={{fontSize:'9px',color:'#00e676',letterSpacing:'0'}}>● Open ER API</span>
            </div>
            {forex.map(fx=>(
              <div key={fx.pair} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid #1a2535'}}>
                <div>
                  <div style={{fontSize:'12px',color:'#eceff1'}}>{fx.flag} {fx.pair}</div>
                  <div style={{fontSize:'10px',color:'#37474f'}}>{fx.label}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'15px',fontWeight:'bold',color:'#f1f5f9'}}>₩{fmt(fx.rate,1)}</div>
                  <div style={{fontSize:'10px',color:clr(-fx.changePercent)}}>
                    {fx.change>0?'+':''}{fx.change.toFixed(1)} ({Math.abs(fx.changePercent).toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Commodities */}
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
            <div style={{fontSize:'10px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'12px'}}>
              🪙 원자재 <span style={{fontSize:'9px',color:'#ffd740',letterSpacing:'0'}}>● yfinance 15~20분 지연</span>
            </div>
            {comods.map(c=>(
              <div key={c.symbol} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                <div>
                  <div style={{fontSize:'12px',color:'#eceff1',fontWeight:'bold'}}>{c.icon} {c.name}</div>
                  <div style={{fontSize:'9px',color:'#37474f'}}>{c.unit}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'13px',color:'#f1f5f9',fontWeight:'bold'}}>${fmt(c.price,c.price<10?3:2)}</div>
                  <div style={{fontSize:'11px',color:clr(c.changePercent),fontWeight:'bold'}}>
                    {c.changePercent>0?'▲':'▼'} {Math.abs(c.changePercent).toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{borderTop:'1px solid #1a2535',paddingTop:'10px',display:'flex',justifyContent:'space-between',fontSize:'9px',color:'#37474f',flexWrap:'wrap',gap:'6px'}}>
          <span>⚡ 라이브 시뮬레이션 4초 | API 갱신 30초 | 뉴스 5분마다 자동 갱신</span>
          <span>📡 데이터: CoinGecko(무료) · Open ER API(무료) · yfinance(15분 지연) · RSS 뉴스피드 | 백엔드(FastAPI) 연동 시 완전 실시간</span>
          <span>⚠️ 투자 판단은 본인 책임 | © 2026 Market Terminal</span>
        </div>
      </div>
    </div>
  );
}
