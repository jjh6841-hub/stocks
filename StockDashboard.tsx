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
  { id:'1', date:'2026-04-02', title:'상호관세 발효 (해방의 날)', imp:'high', type:'geopolitical', desc:'전 세계 교역국 대상 상호관세 발효', country:'US' },
  { id:'2', date:'2026-04-04', title:'美 고용보고서 (NFP)',       imp:'high', type:'economic',     desc:'3월 비농업 고용지표',             country:'US' },
  { id:'3', date:'2026-04-07', title:'FOMC 의사록',              imp:'high', type:'fed',          desc:'3월 FOMC 회의 의사록 공개',       country:'US' },
  { id:'4', date:'2026-04-10', title:'美 CPI',                   imp:'high', type:'economic',     desc:'3월 소비자물가지수',              country:'US' },
  { id:'5', date:'2026-04-14', title:'JPMorgan 실적',            imp:'high', type:'earnings',     desc:'JP모건 1Q 실적 발표',             country:'US' },
  { id:'6', date:'2026-04-14', title:'옵션 만기일',              imp:'med',  type:'options',      desc:'4월 월물 옵션 만기',              country:'US' },
  { id:'7', date:'2026-04-22', title:'TSMC 실적',                imp:'high', type:'earnings',     desc:'TSMC 1Q 실적 발표',               country:'TW' },
  { id:'8', date:'2026-04-23', title:'Tesla 실적',               imp:'high', type:'earnings',     desc:'Tesla 1Q 실적 발표',              country:'US' },
  { id:'9', date:'2026-04-25', title:'FOMC 금리 결정',           imp:'high', type:'fed',          desc:'파월 기자회견 포함',              country:'US' },
  { id:'10',date:'2026-04-30', title:'美 GDP 속보치 (1Q)',       imp:'high', type:'economic',     desc:'1분기 GDP 잠정치',                country:'US' },
  { id:'11',date:'2026-04-30', title:'Microsoft 실적',           imp:'high', type:'earnings',     desc:'Microsoft 1Q 실적 발표',          country:'US' },
  { id:'12',date:'2026-05-01', title:'Apple 실적',               imp:'high', type:'earnings',     desc:'Apple 2Q 실적 발표',              country:'US' },
  { id:'13',date:'2026-05-02', title:'美 고용보고서 (4월)',      imp:'high', type:'economic',     desc:'4월 비농업 고용지표',             country:'US' },
  // ── 2026 미국·한국 증시 휴장일 ────────────────────────────────────
  { id:'hd01',date:'2026-01-01', title:'🇺🇸🇰🇷 신정 · 공동 휴장',          imp:'med', type:'holiday', desc:'뉴욕증권거래소(NYSE) · 한국거래소(KRX) 모두 휴장', country:'US' },
  { id:'hd02',date:'2026-02-16', title:'🇰🇷 설날 연휴 · KRX 휴장',         imp:'med', type:'holiday', desc:'설날 전날 — 한국 증시 휴장', country:'KR' },
  { id:'hd03',date:'2026-02-17', title:'🇰🇷 설날 · KRX 휴장',              imp:'med', type:'holiday', desc:'음력 1월 1일 — 한국 증시 휴장', country:'KR' },
  { id:'hd04',date:'2026-02-18', title:'🇰🇷 설날 연휴 · KRX 휴장',         imp:'med', type:'holiday', desc:'설날 다음날 — 한국 증시 휴장', country:'KR' },
  { id:'hd05',date:'2026-03-02', title:'🇰🇷 삼일절 대체 · KRX 휴장',       imp:'med', type:'holiday', desc:'3·1절 대체공휴일 (3/1 일요일 → 3/2 월요일)', country:'KR' },
  { id:'hd06',date:'2026-04-03', title:'🇺🇸 굿프라이데이 · NYSE 휴장',      imp:'med', type:'holiday', desc:'Good Friday — 미국 증시 휴장', country:'US' },
  { id:'hd07',date:'2026-05-05', title:'🇰🇷 어린이날 · KRX 휴장',          imp:'med', type:'holiday', desc:'한국 증시 휴장', country:'KR' },
  { id:'hd08',date:'2026-05-25', title:'🇺🇸🇰🇷 공동 휴장',                 imp:'med', type:'holiday', desc:'미국 메모리얼데이 + 한국 부처님오신날 대체 (추정)', country:'US' },
  { id:'hd09',date:'2026-06-19', title:'🇺🇸 준틴스데이 · NYSE 휴장',        imp:'med', type:'holiday', desc:'Juneteenth National Independence Day', country:'US' },
  { id:'hd10',date:'2026-07-03', title:'🇺🇸 독립기념일 대체 · NYSE 휴장',   imp:'med', type:'holiday', desc:'7/4 토요일 → 7/3 금요일 대체 휴장', country:'US' },
  { id:'hd11',date:'2026-08-17', title:'🇰🇷 광복절 대체 · KRX 휴장',       imp:'med', type:'holiday', desc:'8/15 토요일 → 8/17 월요일 대체', country:'KR' },
  { id:'hd12',date:'2026-09-07', title:'🇺🇸 노동절 · NYSE 휴장',            imp:'med', type:'holiday', desc:'Labor Day — 미국 증시 휴장', country:'US' },
  { id:'hd13',date:'2026-09-30', title:'🇰🇷 추석 연휴 · KRX 휴장',         imp:'med', type:'holiday', desc:'추석 전날 (추정)', country:'KR' },
  { id:'hd14',date:'2026-10-01', title:'🇰🇷 추석 · KRX 휴장',              imp:'med', type:'holiday', desc:'추석 당일 (추정)', country:'KR' },
  { id:'hd15',date:'2026-10-02', title:'🇰🇷 추석 연휴 · KRX 휴장',         imp:'med', type:'holiday', desc:'추석 다음날 (추정)', country:'KR' },
  { id:'hd16',date:'2026-10-05', title:'🇰🇷 개천절 대체 · KRX 휴장',       imp:'med', type:'holiday', desc:'10/3 토요일 → 10/5 월요일 대체 (추정)', country:'KR' },
  { id:'hd17',date:'2026-10-09', title:'🇰🇷 한글날 · KRX 휴장',             imp:'med', type:'holiday', desc:'한국 증시 휴장', country:'KR' },
  { id:'hd18',date:'2026-11-26', title:'🇺🇸 추수감사절 · NYSE 휴장',        imp:'med', type:'holiday', desc:'Thanksgiving Day — 미국 증시 휴장', country:'US' },
  { id:'hd19',date:'2026-12-25', title:'🇺🇸🇰🇷 크리스마스 · 공동 휴장',     imp:'med', type:'holiday', desc:'NYSE · KRX 모두 휴장', country:'US' },
  { id:'hd20',date:'2026-12-31', title:'🇰🇷 KRX 연말 휴장',                imp:'med', type:'holiday', desc:'한국 증시 연말 휴장', country:'KR' },
];

const EVT_COLOR: Record<string,string> = {
  fed:'#ffd740', earnings:'#40c4ff', economic:'#00e676', options:'#ff9100', geopolitical:'#ff5252',
  holiday:'#4db6ac',
};
const EVT_LABEL: Record<string,string> = {
  fed:'Fed', earnings:'실적', economic:'경제지표', options:'옵션', geopolitical:'지정학', holiday:'휴장일',
};

const ETF_DB = [
  { sym:'SPY',  name:'S&P500 ETF',  tag:'분산', color:'#40c4ff', desc:'미국 500대 기업 분산',    fgRange:[0,100] },
  { sym:'QQQ',  name:'나스닥100',    tag:'성장', color:'#00e676', desc:'빅테크·AI 집중 성장주',   fgRange:[45,80] },
  { sym:'XLK',  name:'AI·테크',      tag:'섹터', color:'#b39ddb', desc:'반도체·소프트웨어',       fgRange:[45,80] },
  { sym:'SOXX', name:'반도체 ETF',   tag:'테마', color:'#80deea', desc:'AI 인프라 핵심 수혜',     fgRange:[40,75] },
  { sym:'ITA',  name:'방위산업 ETF', tag:'방어', color:'#ffd740', desc:'지정학 리스크 헤지',      fgRange:[0,60] },
  { sym:'IBB',  name:'바이오 ETF',   tag:'테마', color:'#a5d6a7', desc:'신약·고령화 테마',        fgRange:[30,70] },
  { sym:'GLD',  name:'금 ETF',       tag:'헤지', color:'#ffe082', desc:'인플레·불확실성 헤지',    fgRange:[0,45] },
  { sym:'TLT',  name:'장기국채 ETF', tag:'채권', color:'#b0c4cc', desc:'금리 하락 기대 포지션',   fgRange:[0,40] },
];

const fmt = (n:number, d=2) => isNaN(n)||n===0 ? '—' : n.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtCap = (n:number) => n>=1e12?`$${(n/1e12).toFixed(2)}T`:n>=1e9?`$${(n/1e9).toFixed(1)}B`:`$${(n/1e6).toFixed(0)}M`;
const clr = (v:number) => v>0?'#00e676':v<0?'#ff5252':'#b0c4cc';
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
interface InvestorEntry { code:string; name:string; amount:number; }
interface MarketData {
  updatedAt:string; quotes:Record<string,Quote>; crypto:any[];
  forex:Record<string,number>; fearGreed:{value:number;label:string}; news:any[];
  investorTrading?:{date:string;data:Record<string,{buy:InvestorEntry[];sell:InvestorEntry[]}>};
}

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
  const LABEL: Record<string,string>={'Extreme Fear':'극도의 공포','Fear':'공포','Neutral':'중립','Greed':'탐욕','Extreme Greed':'극도의 탐욕'};
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
      <div style={{color:zone.c,fontWeight:'bold',fontSize:'14px',marginTop:'-2px'}}>{LABEL[data.label]??data.label}</div>
      <div style={{color:'#8ea5b0',fontSize:'12px'}}>Alternative.me 공포&탐욕</div>
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
          <div style={{fontSize:'12px',color:'#8ea5b0',letterSpacing:'1px'}}>{meta.sym}</div>
          <div style={{fontSize:'14px',color:'#b0c4cc'}}>{meta.name}</div>
        </div>
        {spark.length>1&&<Sparkline data={spark} pos={pos}/>}
      </div>
      {loading?<div style={{padding:'10px'}}><Spinner s={20}/></div>:!q?
        <div style={{fontSize:'13px',color:'#8ea5b0',padding:'10px'}}>데이터 없음</div>:
        <>
          <div style={{fontSize:'22px',fontWeight:'bold',color:'#eceff1',marginBottom:'4px'}}>{fmt(q.price)}</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{background:bg(q.changePct),color:c,padding:'2px 8px',borderRadius:'4px',fontSize:'13px',fontWeight:'bold'}}>
              {pos?'▲':'▼'} {Math.abs(q.changePct).toFixed(2)}%
            </span>
            <span style={{fontSize:'12px',color:'#8ea5b0'}}>{q.change>=0?'+':''}{fmt(q.change)}</span>
          </div>
          {pct52!=null&&q.high52w>0&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#607d8b',marginBottom:'2px'}}>
                <span>52W 저점</span>
                <span style={{color:pct52<20?'#00e676':pct52>80?'#ff5252':'#8ea5b0'}}>{zone}</span>
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

// ── 섹터 카드: 종목명과 % 거리 좁힘 ──────────────────────────────────
const SectorCard: React.FC<{def:typeof SECTOR_DEF[0];quotes:Record<string,Quote>;loading:boolean}> = ({def,quotes,loading}) => {
  const eq=quotes[def.yf], pct=eq?.changePct??0;
  return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{fontSize:'17px'}}>{def.icon}</span>
          <div>
            <div style={{fontWeight:'bold',color:'#eceff1',fontSize:'14px'}}>{def.name}</div>
            <div style={{color:'#607d8b',fontSize:'11px'}}>{def.yf} ETF</div>
          </div>
        </div>
        {loading?<Spinner/>:<span style={{color:clr(pct),fontWeight:'bold',fontSize:'15px'}}>{pct>=0?'+':''}{pct.toFixed(2)}%</span>}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
        {def.stocks.map(sym=>{
          const q=quotes[sym]; const sc=q?sigColor(q.changePct):'#40c4ff'; const sl=q?sigLabel(q.changePct):'—';
          return (
            <div key={sym} style={{background:'#0a1628',borderRadius:'5px',padding:'4px 7px',border:`1px solid ${sc}22`}}>
              <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{fontSize:'11px',color:'#8ea5b0',flexShrink:0,width:'36px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sym.replace('.KS','')}</span>
                <span style={{fontSize:'12px',color:'#b0bec5',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{STOCK_NAME[sym]??sym}</span>
                {loading||!q
                  ? <Spinner/>
                  : <>
                      <span style={{color:clr(q.changePct),fontSize:'13px',fontWeight:'bold',flexShrink:0}}>{q.changePct>=0?'+':''}{q.changePct.toFixed(2)}%</span>
                      <span style={{background:sc+'22',color:sc,fontSize:'10px',padding:'1px 4px',borderRadius:'3px',flexShrink:0}}>{sl}</span>
                    </>
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Google Calendar ──────────────────────────────────────────────────
const MONTHS_KO=['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAYS_KO=['일','월','화','수','목','금','토'];

const GoogleCalendar: React.FC<{events:typeof CALENDAR;today:string}> = ({events,today}) => {
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
  while(weeks.length<6){weeks.push(Array(7).fill(null));} // 항상 6행 고정

  return (
    <div style={{background:'#0d1b2e',borderRadius:'8px',padding:'16px',border:'1px solid #1a3050'}}>
      {/* 헤더 */}
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px'}}>
        <button onClick={prev} style={{background:'#1a2535',border:'none',color:'#b0c4cc',cursor:'pointer',width:'30px',height:'30px',borderRadius:'50%',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>‹</button>
        <span style={{fontSize:'18px',fontWeight:'bold',color:'#eceff1',flex:1}}>{yr}년 {MONTHS_KO[mo]}</span>
        <button onClick={goT} style={{background:'#1a2535',border:'1px solid #40c4ff44',color:'#40c4ff',cursor:'pointer',padding:'5px 12px',borderRadius:'6px',fontSize:'13px',fontFamily:'inherit'}}>오늘</button>
        <button onClick={next} style={{background:'#1a2535',border:'none',color:'#b0c4cc',cursor:'pointer',width:'30px',height:'30px',borderRadius:'50%',fontSize:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit'}}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'4px'}}>
        {DAYS_KO.map((d,i)=>(
          <div key={d} style={{textAlign:'center',fontSize:'13px',fontWeight:'bold',padding:'4px 0',
            color:i===0?'#ff5252':i===6?'#5c9eff':'#8ea5b0'}}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
        {weeks.map((wk,wi)=>(
          <div key={wi} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'3px'}}>
            {wk.map((day,di)=>{
              if(!day) return <div key={di} style={{minHeight:'110px',background:'rgba(6,13,26,.6)',borderRadius:'6px'}}/>;
              const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const isT=ds===today;
              const dayEvs=events.filter(e=>e.date===ds);
              const isPast=ds<today;
              return (
                <div key={di} style={{
                  minHeight:'110px',
                  background:isT?'rgba(64,196,255,.08)':isPast?'rgba(10,22,40,.5)':'#0a1628',
                  borderRadius:'6px',padding:'6px',
                  border:isT?'1px solid #40c4ff66':'1px solid #1a2535',
                }}>
                  <div style={{
                    width:'26px',height:'26px',borderRadius:'50%',
                    background:isT?'#40c4ff':'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    marginBottom:'4px',
                    fontSize:'14px',fontWeight:isT?'bold':'normal',
                    color:isT?'#060d1a':di===0?'#ff5252':di===6?'#5c9eff':isPast?'#607d8b':'#b0c4cc',
                  }}>{day}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                    {dayEvs.map(ev=>{
                      const ec=EVT_COLOR[ev.type]??'#8ea5b0';
                      return (
                        <div key={ev.id}
                          onClick={()=>setSel(sel?.id===ev.id?null:ev)}
                          style={{
                            background:ec+'25',borderLeft:`2px solid ${ec}`,
                            borderRadius:'3px',padding:'3px 5px',
                            fontSize:'12px',color:ec,
                            cursor:'pointer',lineHeight:'1.4',wordBreak:'keep-all',
                          }}>
                          {ev.imp==='high'?'●':'○'} {ev.title}
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
        <div style={{marginTop:'12px',background:'#060d1a',borderRadius:'8px',padding:'12px',border:`1px solid ${EVT_COLOR[sel.type]??'#1a2535'}55`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
            <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
              <span style={{fontSize:'11px',padding:'2px 7px',borderRadius:'3px',
                background:(EVT_COLOR[sel.type]??'#8ea5b0')+'22',
                color:EVT_COLOR[sel.type]??'#8ea5b0',
                border:`1px solid ${EVT_COLOR[sel.type]??'#8ea5b0'}44`}}>
                {EVT_LABEL[sel.type]??sel.type}
              </span>
              <span style={{fontSize:'12px',color:'#8ea5b0'}}>{sel.date} · {sel.country}</span>
              <span style={{fontSize:'11px',color:sel.imp==='high'?'#ff5252':sel.imp==='med'?'#ffd740':'#00e676'}}>
                {'▮'.repeat(sel.imp==='high'?3:sel.imp==='med'?2:1)}
              </span>
            </div>
            <button onClick={()=>setSel(null)} style={{background:'none',border:'none',color:'#8ea5b0',cursor:'pointer',fontSize:'18px',padding:'0 4px'}}>×</button>
          </div>
          <div style={{fontSize:'16px',color:'#eceff1',fontWeight:'bold',marginBottom:'4px'}}>{sel.title}</div>
          {sel.desc&&<div style={{fontSize:'13px',color:'#b0c4cc'}}>{sel.desc}</div>}
        </div>
      )}

      {/* 범례 */}
      <div style={{display:'flex',gap:'14px',fontSize:'12px',color:'#607d8b',marginTop:'12px',flexWrap:'wrap'}}>
        {Object.entries(EVT_COLOR).map(([k,c])=>(
          <span key={k}><span style={{color:c}}>■</span> {EVT_LABEL[k]}</span>
        ))}
      </div>
    </div>
  );
};

// ── 시장 분석 & ETF 추천 ─────────────────────────────────────────────
const MarketAnalysis: React.FC<{quotes:Record<string,Quote>;fg:{value:number;label:string}|null;loading:boolean}> = ({quotes,fg,loading}) => {
  const fgVal=fg?.value??50;

  const sectorPerf=SECTOR_DEF.map(s=>({
    ...s, pct:quotes[s.yf]?.changePct??0, ok:!!quotes[s.yf],
  })).filter(s=>s.ok).sort((a,b)=>b.pct-a.pct);

  const positions=IDX_META.map(m=>{
    const q=quotes[m.yf];
    if(!q||!q.high52w||!q.low52w||q.high52w===q.low52w) return null;
    return ((q.price-q.low52w)/(q.high52w-q.low52w))*100;
  }).filter((v):v is number=>v!=null);
  const avgPos=positions.length?positions.reduce((a,b)=>a+b,0)/positions.length:50;

  let phase='',phaseColor='',phaseDesc='',strategy='';
  if(fgVal<25&&avgPos<35){
    phase='극단적 공포 — 분할매수 타이밍';phaseColor='#00e676';
    phaseDesc='공포 지수 극단 + 52주 저점권. 역사적으로 중장기 매수 기회 구간입니다.';
    strategy='현금 비중 줄이고 우량 ETF(SPY·QQQ) 분할매수 시작 권장';
  } else if(fgVal<40){
    phase='공포 구간 — 방어적 관망';phaseColor='#ffd740';
    phaseDesc='시장 심리 위축. 섣부른 추격매수는 위험. 헤지 자산 병행 권장.';
    strategy='금(GLD)·방산(ITA) 비중 유지, 핵심 지수 소량 분할매수만';
  } else if(fgVal>75&&avgPos>70){
    phase='과열 경계 — 익절 고려 구간';phaseColor='#ff5252';
    phaseDesc='탐욕 심리 과열 + 고점권 동시 신호. 차익 실현 고려 시점.';
    strategy='일부 익절 및 현금·채권 비중 확대, 방어 포지션 이동';
  } else if(fgVal>60){
    phase='상승 추세 — 모멘텀 추종';phaseColor='#00e676';
    phaseDesc='긍정적 심리 지속 중. 상승 섹터 집중 전략이 유효합니다.';
    strategy='성장·테크 ETF 비중 확대, 손절 라인 타이트하게 관리';
  } else {
    phase='중립 — 선별적 접근';phaseColor='#b0c4cc';
    phaseDesc='방향성 불명확. 섹터 로테이션에 집중하며 분산 유지 권장.';
    strategy='섹터 순환 주시하며 분할매수, 한 섹터 집중 투자 지양';
  }

  // FG 범위 기반 ETF 필터
  const recEtfs=ETF_DB.filter(e=>fgVal>=e.fgRange[0]&&fgVal<=e.fgRange[1]).slice(0,4);
  // 상위 섹터 ETF 반영
  if(sectorPerf.length>0&&!recEtfs.find(e=>e.sym===sectorPerf[0].yf)){
    const found=ETF_DB.find(e=>e.sym===sectorPerf[0].yf);
    if(found) recEtfs.unshift(found);
  }
  const finalEtfs=recEtfs.slice(0,4);

  if(loading) return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'24px',textAlign:'center'}}>
      <Spinner s={20}/><div style={{color:'#8ea5b0',fontSize:'13px',marginTop:'8px'}}>시장 분석 중...</div>
    </div>
  );

  return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'16px'}}>
      <div style={{fontSize:'12px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'14px'}}>
        🧭 시장 분석 & ETF 추천 <span style={{fontSize:'11px',color:'#8ea5b0',letterSpacing:'0'}}>· 공포&탐욕 + 52주 포지션 기반 자동 분석</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',gap:'12px'}}>
        {/* 시장 국면 */}
        <div style={{background:'#060d1a',borderRadius:'8px',padding:'14px',border:`1px solid ${phaseColor}33`}}>
          <div style={{fontSize:'11px',color:'#8ea5b0',letterSpacing:'1px',marginBottom:'8px'}}>현재 시장 국면</div>
          <div style={{fontSize:'15px',fontWeight:'bold',color:phaseColor,marginBottom:'10px',lineHeight:'1.4'}}>{phase}</div>
          <div style={{fontSize:'13px',color:'#b0c4cc',lineHeight:'1.6',marginBottom:'10px'}}>{phaseDesc}</div>
          <div style={{background:phaseColor+'12',borderLeft:`3px solid ${phaseColor}`,padding:'7px 10px',borderRadius:'4px',fontSize:'13px',color:phaseColor,lineHeight:'1.5'}}>
            💡 {strategy}
          </div>
          <div style={{display:'flex',gap:'16px',marginTop:'12px'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'24px',fontWeight:'bold',color:fgVal<40?'#ff5252':fgVal>60?'#00e676':'#ffd740'}}>{fgVal}</div>
              <div style={{fontSize:'11px',color:'#8ea5b0'}}>공포&탐욕</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'24px',fontWeight:'bold',color:avgPos<30?'#00e676':avgPos>70?'#ff5252':'#40c4ff'}}>{avgPos.toFixed(0)}%</div>
              <div style={{fontSize:'11px',color:'#8ea5b0'}}>52주 평균</div>
            </div>
          </div>
        </div>

        {/* 섹터 모멘텀 */}
        <div style={{background:'#060d1a',borderRadius:'8px',padding:'14px',border:'1px solid #1a2535'}}>
          <div style={{fontSize:'11px',color:'#8ea5b0',letterSpacing:'1px',marginBottom:'10px'}}>오늘 섹터 성과 순위</div>
          {sectorPerf.length===0
            ? <div style={{color:'#607d8b',fontSize:'13px',paddingTop:'20px',textAlign:'center'}}>데이터 로딩 중...</div>
            : sectorPerf.map((s,i)=>{
                const barW=Math.min(100,Math.abs(s.pct)*20+10);
                return (
                  <div key={s.yf} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
                    <div style={{fontSize:'13px',color:'#607d8b',width:'12px',textAlign:'right',flexShrink:0}}>{i+1}</div>
                    <div style={{fontSize:'15px',flexShrink:0}}>{s.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                        <span style={{fontSize:'13px',color:'#eceff1'}}>{s.name}</span>
                        <span style={{fontSize:'14px',fontWeight:'bold',color:clr(s.pct)}}>{s.pct>=0?'+':''}{s.pct.toFixed(2)}%</span>
                      </div>
                      <div style={{height:'4px',background:'#1a2535',borderRadius:'2px'}}>
                        <div style={{height:'100%',width:`${barW}%`,background:clr(s.pct),borderRadius:'2px',transition:'width .5s'}}/>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* ETF 추천 */}
        <div style={{background:'#060d1a',borderRadius:'8px',padding:'14px',border:'1px solid #1a2535'}}>
          <div style={{fontSize:'11px',color:'#8ea5b0',letterSpacing:'1px',marginBottom:'10px'}}>
            추천 ETF <span style={{color:'#607d8b'}}>· 현재 공포&탐욕 지수({fgVal}) 기반</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
            {finalEtfs.map((e,i)=>(
              <div key={e.sym} style={{background:'#0d1b2e',borderRadius:'8px',padding:'12px',border:`1px solid ${e.color}33`,position:'relative'}}>
                {i===0&&<div style={{position:'absolute',top:'8px',right:'8px',fontSize:'10px',background:'#ffd740',color:'#060d1a',borderRadius:'3px',padding:'1px 5px',fontWeight:'bold'}}>TOP</div>}
                <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
                  <span style={{background:e.color+'22',color:e.color,fontSize:'11px',padding:'2px 6px',borderRadius:'4px',fontWeight:'bold'}}>{e.tag}</span>
                </div>
                <div style={{fontSize:'18px',fontWeight:'bold',color:e.color,marginBottom:'2px'}}>{e.sym}</div>
                <div style={{fontSize:'13px',color:'#b0c4cc',marginBottom:'4px'}}>{e.name}</div>
                <div style={{fontSize:'12px',color:'#8ea5b0',lineHeight:'1.4'}}>{e.desc}</div>
              </div>
            ))}
            {finalEtfs.length===0&&(
              <div style={{gridColumn:'1/-1',textAlign:'center',color:'#607d8b',fontSize:'13px',padding:'20px'}}>
                시장 데이터 로딩 후 표시됩니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── TradingView ──────────────────────────────────────────────────────
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

// ── 👥 투자자별 순매수 패널 ────────────────────────────────────────────
// ── 시장 전망 컴포넌트 ────────────────────────────────────────────────────
const MarketOutlook: React.FC<{quotes:Record<string,Quote>;fg:{value:number;label:string};news:any[];loading:boolean}> = ({quotes,fg,news,loading}) => {
  const now = new Date();

  // 지수 분석
  const idxData = IDX_META.map(m=>({...m,pct:quotes[m.yf]?.changePct??0,ok:!!quotes[m.yf]}));
  const kospi = idxData.find(m=>m.sym==='KOSPI');
  const spx   = idxData.find(m=>m.sym==='SPX');
  const ndx   = idxData.find(m=>m.sym==='NDX');
  const upCnt = idxData.filter(m=>m.ok&&m.pct>0).length;
  const dnCnt = idxData.filter(m=>m.ok&&m.pct<0).length;

  // 섹터 분석
  const secData = SECTOR_DEF.map(s=>({...s,pct:quotes[s.yf]?.changePct??0,ok:!!quotes[s.yf]}));
  const topSec  = [...secData].filter(s=>s.ok).sort((a,b)=>b.pct-a.pct).slice(0,2);
  const botSec  = [...secData].filter(s=>s.ok).sort((a,b)=>a.pct-b.pct).slice(0,1);

  // 종합 심리
  const fgV = fg.value;
  const sentiment = fgV>=60?'강세':fgV<=30?'약세':'중립';
  const sentColor = fgV>=60?'#00e676':fgV<=30?'#ff5252':'#ffd740';

  // 뉴스 키워드 요약
  const trumpCnt  = news.filter(n=>n.isTrump).length;
  const fedCnt    = news.filter(n=>n.category==='macro').length;
  const techCnt   = news.filter(n=>n.category==='tech').length;

  // 향후 7일 주요 이벤트
  const today = now.toISOString().slice(0,10);
  const next7 = new Date(now); next7.setDate(next7.getDate()+7);
  const upcoming = CALENDAR
    .filter(e=>e.date>=today && e.date<=next7.toISOString().slice(0,10) && e.imp==='high')
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(0,4);

  // 전망 판단
  const outlookLines: {icon:string;text:string;color:string}[] = [];

  if(fgV<=25) outlookLines.push({icon:'⚠️',text:'극단적 공포 구간 — 단기 반등 가능성이 있으나 추세 전환 확인 필요',color:'#ff8a65'});
  else if(fgV<=40) outlookLines.push({icon:'🔴',text:'공포 구간 — 방어적 접근 권장, 저점 분할 매수 고려',color:'#ff5252'});
  else if(fgV>=75) outlookLines.push({icon:'🟡',text:'과열 구간 — 차익실현 압력 증가, 추가 매수 시 신중 필요',color:'#ffd740'});
  else if(fgV>=55) outlookLines.push({icon:'🟢',text:'낙관 구간 — 추세 지속 가능성, 모멘텀 종목 주목',color:'#00e676'});
  else             outlookLines.push({icon:'⚪',text:'중립 구간 — 선별적 접근, 실적·지표 발표 전후 변동성 주의',color:'#b0c4cc'});

  if(upCnt>=6)       outlookLines.push({icon:'📈',text:`글로벌 ${upCnt}/8개 지수 상승 — 위험선호 심리 우세`,color:'#00e676'});
  else if(dnCnt>=6)  outlookLines.push({icon:'📉',text:`글로벌 ${dnCnt}/8개 지수 하락 — 리스크 회피 국면`,color:'#ff5252'});

  if(trumpCnt>=3)    outlookLines.push({icon:'🏛️',text:`트럼프 관세·무역 뉴스 ${trumpCnt}건 — 수출주 변동성 확대 주의`,color:'#ff9100'});
  if(fedCnt>=3)      outlookLines.push({icon:'🏦',text:`연준·금리 관련 뉴스 활발 — 금리 민감 섹터(바이오·성장주) 주의`,color:'#ffd740'});
  if(techCnt>=3)     outlookLines.push({icon:'💡',text:`테크·반도체 뉴스 집중 — AI 섹터 방향성 주시`,color:'#40c4ff'});

  // 추천 종목 (상위 섹터 내 주요 종목)
  const watchStocks: {name:string;sym:string;reason:string;color:string}[] = [];
  topSec.forEach(s=>{
    const topStock = s.stocks[0];
    const sName = STOCK_NAME[topStock]||topStock;
    watchStocks.push({name:sName, sym:topStock, reason:`${s.name} 섹터 강세 수혜`, color:'#00e676'});
  });
  if(fgV<=35) {
    watchStocks.push({name:'금 (GOLD)',sym:'GC=F',reason:'공포 구간 안전자산 선호',color:'#ffd740'});
  }
  if(kospi&&kospi.pct<-1 && spx&&spx.pct>0) {
    watchStocks.push({name:'SK하이닉스',sym:'000660.KS',reason:'KOSPI 약세·미국 강세 괴리 — 반등 기대',color:'#40c4ff'});
  }

  return (
    <div style={{padding:'4px 0'}}>
      {/* 업데이트 시각 */}
      <div style={{fontSize:'10px',color:'#607d8b',marginBottom:'12px'}}>
        🔄 {loading?'로딩 중...':now.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 기준 · 10분 자동 갱신
      </div>

      {/* 공포탐욕 요약 */}
      <div style={{background:'#06111f',borderRadius:'8px',padding:'10px 12px',marginBottom:'10px',border:`1px solid ${sentColor}44`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:'#b0c4cc'}}>공포탐욕 지수</span>
          <span style={{fontSize:'20px',fontWeight:'800',color:sentColor}}>{fgV}</span>
        </div>
        <div style={{fontSize:'13px',fontWeight:'700',color:sentColor,marginTop:'2px'}}>{sentiment} — {fg.label}</div>
        <div style={{height:'4px',background:'#1a2535',borderRadius:'2px',marginTop:'8px'}}>
          <div style={{height:'100%',width:`${fgV}%`,background:`linear-gradient(90deg,#ff5252,#ffd740 50%,#00e676)`,borderRadius:'2px'}}/>
        </div>
      </div>

      {/* 전망 판단 */}
      <div style={{marginBottom:'10px'}}>
        <div style={{fontSize:'11px',color:'#8ea5b0',marginBottom:'6px',letterSpacing:'1px'}}>📊 종합 전망</div>
        {outlookLines.map((l,i)=>(
          <div key={i} style={{display:'flex',gap:'6px',padding:'6px 0',borderBottom:'1px solid #1a2535',alignItems:'flex-start'}}>
            <span style={{fontSize:'13px',flexShrink:0}}>{l.icon}</span>
            <span style={{fontSize:'12px',color:l.color,lineHeight:'1.5'}}>{l.text}</span>
          </div>
        ))}
      </div>

      {/* 주목 섹터 */}
      {topSec.length>0&&(
        <div style={{marginBottom:'10px'}}>
          <div style={{fontSize:'11px',color:'#8ea5b0',marginBottom:'6px',letterSpacing:'1px'}}>🔥 강세 섹터</div>
          {topSec.map(s=>(
            <div key={s.yf} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'#06111f',borderRadius:'6px',marginBottom:'4px',borderLeft:'2px solid #00e676'}}>
              <span style={{fontSize:'13px',color:'#eceff1'}}>{s.icon} {s.name}</span>
              <span style={{fontSize:'13px',fontWeight:'700',color:'#00e676'}}>▲{Math.abs(s.pct).toFixed(2)}%</span>
            </div>
          ))}
          {botSec.map(s=>(
            <div key={s.yf} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'#06111f',borderRadius:'6px',marginBottom:'4px',borderLeft:'2px solid #ff5252'}}>
              <span style={{fontSize:'13px',color:'#eceff1'}}>{s.icon} {s.name}</span>
              <span style={{fontSize:'13px',fontWeight:'700',color:'#ff5252'}}>▼{Math.abs(s.pct).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* 주목 종목 */}
      {watchStocks.length>0&&(
        <div style={{marginBottom:'10px'}}>
          <div style={{fontSize:'11px',color:'#8ea5b0',marginBottom:'6px',letterSpacing:'1px'}}>💡 주목 종목</div>
          {watchStocks.map((s,i)=>(
            <div key={i} style={{padding:'6px 8px',background:'#06111f',borderRadius:'6px',marginBottom:'4px',borderLeft:`2px solid ${s.color}`}}>
              <div style={{fontSize:'13px',color:'#eceff1',fontWeight:'600'}}>{s.name}</div>
              <div style={{fontSize:'11px',color:'#8ea5b0',marginTop:'2px'}}>{s.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* 향후 주요 이벤트 */}
      {upcoming.length>0&&(
        <div>
          <div style={{fontSize:'11px',color:'#8ea5b0',marginBottom:'6px',letterSpacing:'1px'}}>📅 향후 7일 주요 이벤트</div>
          {upcoming.map(e=>(
            <div key={e.id} style={{display:'flex',gap:'8px',padding:'5px 0',borderBottom:'1px solid #1a2535',alignItems:'flex-start'}}>
              <span style={{fontSize:'11px',color:'#607d8b',flexShrink:0,marginTop:'1px'}}>{e.date.slice(5)}</span>
              <span style={{fontSize:'12px',color:'#eceff1'}}>{e.title}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:'12px',fontSize:'10px',color:'#607d8b',lineHeight:'1.6'}}>
        ※ 본 전망은 현재 시장 데이터 기반 자동 분석이며 투자 권유가 아닙니다.
      </div>
    </div>
  );
};

const INV_TYPES = ['외국인','기관','연기금','개인'] as const;
const INV_COLORS: Record<string,string> = {
  '외국인':'#40c4ff','기관':'#69f0ae','연기금':'#ffd740','개인':'#ff8a65',
};
const fmtBnD = (n:number) =>
  n>=1e12?`${(n/1e12).toFixed(1)}조`:n>=1e8?`${(n/1e8).toFixed(0)}억`:`${(n/1e4).toFixed(0)}만`;

const InvestorTradingPanel: React.FC<{data:MarketData['investorTrading']}> = ({data}) => {
  const [inv,setInv]   = useState<string>('외국인');
  const [side,setSide] = useState<'buy'|'sell'>('buy');
  if(!data?.data) return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'16px',marginBottom:'14px',color:'#607d8b',fontSize:'12px',textAlign:'center'}}>
      👥 투자자별 순매수 — GitHub Actions 다음 실행 후 표시됩니다 (KOSPI · pykrx)
    </div>
  );
  const list = data.data[inv]?.[side] ?? [];
  const maxAmt = Math.max(...list.map(x=>x.amount), 1);
  const accentColor = INV_COLORS[inv] ?? '#40c4ff';
  const dateLabel = data.date
    ? `${data.date.slice(0,4)}-${data.date.slice(4,6)}-${data.date.slice(6,8)} 기준 · KOSPI · pykrx`
    : '';

  return (
    <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'16px',marginBottom:'14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px',flexWrap:'wrap',gap:'8px'}}>
        <div style={{fontSize:'12px',letterSpacing:'2px',color:'#40c4ff'}}>
          👥 투자자별 순매수 TOP 10 <span style={{fontSize:'11px',color:'#8ea5b0',letterSpacing:'0'}}>· {dateLabel}</span>
        </div>
        {/* buy/sell toggle */}
        <div style={{display:'flex',gap:'4px'}}>
          {(['buy','sell'] as const).map(s=>(
            <button key={s} onClick={()=>setSide(s)} style={{
              padding:'4px 12px',borderRadius:'6px',border:'none',cursor:'pointer',fontSize:'12px',fontWeight:'700',
              background: side===s?(s==='buy'?'rgba(0,230,118,.2)':'rgba(255,82,82,.2)'):'#1a2535',
              color: side===s?(s==='buy'?'#00e676':'#ff5252'):'#8ea5b0',
            }}>{s==='buy'?'▲ 순매수':'▼ 순매도'}</button>
          ))}
        </div>
      </div>

      {/* 투자자 탭 */}
      <div style={{display:'flex',gap:'6px',marginBottom:'14px'}}>
        {INV_TYPES.map(t=>(
          <button key={t} onClick={()=>setInv(t)} style={{
            padding:'5px 14px',borderRadius:'16px',border:'none',cursor:'pointer',fontSize:'12px',fontWeight:'600',
            background: inv===t ? INV_COLORS[t] : '#1a2535',
            color: inv===t ? '#060d1a' : '#8ea5b0',
          }}>{t}</button>
        ))}
      </div>

      {/* TOP 10 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px'}}>
        {list.length===0
          ? <div style={{gridColumn:'1/-1',color:'#607d8b',fontSize:'12px',textAlign:'center',padding:'12px'}}>데이터 없음</div>
          : list.slice(0,10).map((item,i)=>(
            <div key={item.code} style={{padding:'7px 10px',background:'#06111f',borderRadius:'6px',border:'1px solid #1a2535'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <span style={{fontSize:'11px',color:'#607d8b',fontWeight:'700'}}>{i+1}</span>
                  <span style={{fontSize:'13px',color:'#eceff1',fontWeight:'600'}}>{item.name}</span>
                </div>
                <span style={{fontSize:'13px',fontWeight:'700',color:side==='buy'?'#00e676':'#ff5252'}}>{fmtBnD(item.amount)}</span>
              </div>
              <div style={{height:'4px',background:'#1a2535',borderRadius:'2px'}}>
                <div style={{height:'100%',width:`${(item.amount/maxAmt)*100}%`,background:accentColor,borderRadius:'2px',opacity:0.6}}/>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════
export default function StockDashboard() {
  const [nowT,setNow]     = useState(new Date());
  const [mdata,setMdata]  = useState<MarketData|null>(null);
  const [cryptoRT,setCR]  = useState<any[]>([]);
  const [forexRT,setFR]   = useState<Record<string,number>>({});
  const [sparks,setSparks]= useState<Record<string,number[]>>({});
  const [loading,setLoad] = useState(true);
  const [stale,setStale]  = useState(false);
  const [tab,setTab]      = useState<'news'|'coin'|'forex'|'com'|'outlook'>('news');
  const [nf,setNF]        = useState('all');
  const [alerts,setAlerts]= useState<{id:number;text:string;type:string}[]>([]);

  const addAlert=(text:string,type:string)=>{
    const id=Date.now();
    setAlerts(p=>[{id,text,type},...p].slice(0,4));
    setTimeout(()=>setAlerts(p=>p.filter(a=>a.id!==id)),9000);
  };

  const loadStatic=useCallback(async()=>{
    try {
      const r=await fetch(`${DATA_URL}?t=${Date.now()}`);
      if(!r.ok) throw new Error(`${r.status}`);
      const d:MarketData=await r.json();
      if(!d.updatedAt) return;
      setMdata(d);
      setLoad(false);
      setSparks(prev=>{
        const n={...prev};
        Object.entries(d.quotes).forEach(([k,q])=>{ n[k]=[...(n[k]??[]).slice(-23),q.price]; });
        return n;
      });
      const age=(Date.now()-new Date(d.updatedAt).getTime())/60000;
      setStale(age>15);
      d.news.filter((n:any)=>n.isTrump).slice(0,1).forEach((n:any)=>
        addAlert(`🎭 ${n.title.slice(0,55)}…`,'trump'));
    } catch(e) {
      console.warn('market-data.json 로드 실패:',e);
      setLoad(false);
    }
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
  const ms=getMarketStatus();
  const today=new Date().toISOString().split('T')[0];
  const usdKrw=rawRates.KRW??0;
  const forexList=[
    {pair:'USD/KRW',flag:'🇺🇸',label:'달러/원',   r:usdKrw},
    {pair:'EUR/KRW',flag:'🇪🇺',label:'유로/원',   r:usdKrw&&rawRates.EUR?usdKrw/rawRates.EUR:0},
    {pair:'JPY/KRW',flag:'🇯🇵',label:'100엔/원',  r:usdKrw&&rawRates.JPY?(usdKrw/rawRates.JPY)*100:0},
    {pair:'CNY/KRW',flag:'🇨🇳',label:'위안/원',   r:usdKrw&&rawRates.CNY?usdKrw/rawRates.CNY:0},
    {pair:'GBP/KRW',flag:'🇬🇧',label:'파운드/원', r:usdKrw&&rawRates.GBP?usdKrw/rawRates.GBP:0},
  ];
  const filteredNews=nf==='all'?news:nf==='trump'?news.filter((n:any)=>n.isTrump):news.filter((n:any)=>n.category===nf);
  const updTime=mdata?.updatedAt?new Date(mdata.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):null;

  const tabS=(k:typeof tab):React.CSSProperties=>({padding:'6px 10px',border:'none',cursor:'pointer',fontSize:'12px',fontFamily:'inherit',borderBottom:tab===k?'2px solid #40c4ff':'2px solid transparent',background:'transparent',color:tab===k?'#40c4ff':'#8ea5b0',fontWeight:tab===k?'bold':'normal',whiteSpace:'nowrap' as const});
  const fBtnS=(k:string):React.CSSProperties=>({padding:'3px 10px',borderRadius:'4px',border:`1px solid ${nf===k?'#40c4ff':'#1a2535'}`,background:nf===k?'#40c4ff22':'transparent',color:nf===k?'#40c4ff':'#8ea5b0',cursor:'pointer',fontSize:'13px',fontFamily:'inherit'});

  return (
    <div style={{background:'#060d1a',color:'#e0e6ed',fontFamily:"'Inter','Noto Sans KR',system-ui,sans-serif",minHeight:'100vh',margin:0,padding:0}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap');
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
        *{box-sizing:border-box;scrollbar-width:thin;scrollbar-color:#1a2535 #060d1a;font-family:'Inter','Noto Sans KR',system-ui,sans-serif}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:#1a2535;border-radius:3px}
        button{font-family:'Inter','Noto Sans KR',system-ui,sans-serif}
      `}</style>

      {/* 알림 */}
      <div style={{position:'fixed',top:'64px',right:'12px',zIndex:3000,display:'flex',flexDirection:'column',gap:'6px'}}>
        {alerts.map(a=>(
          <div key={a.id} style={{background:a.type==='trump'?'#1a0808':'#0a1220',border:`1px solid ${a.type==='trump'?'#ff5252':'#40c4ff'}`,borderRadius:'8px',padding:'8px 12px',maxWidth:'320px',fontSize:'13px',color:'#cfd8dc',animation:'slideIn .3s ease',boxShadow:'0 4px 12px rgba(0,0,0,.6)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:'8px'}}>
              <div>{a.text}</div>
              <button onClick={()=>setAlerts(p=>p.filter(x=>x.id!==a.id))} style={{background:'none',border:'none',color:'#8ea5b0',cursor:'pointer',fontSize:'16px',padding:0}}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div style={{background:'linear-gradient(135deg,#07122a,#0d1f3f)',borderBottom:'2px solid #00d4ff33',padding:'10px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:1000,boxShadow:'0 4px 24px rgba(0,212,255,.15)'}}>
        <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
          <div style={{fontSize:'19px',fontWeight:'bold',background:'linear-gradient(90deg,#00d4ff,#00e676)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>◆ MARKET TERMINAL</div>
          <div style={{fontSize:'11px',color:'#607d8b',letterSpacing:'1px'}}>GitHub Actions 10분 갱신 · yfinance · CoinGecko · Alternative.me · RSS</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px',fontSize:'13px'}}>
          {stale&&<span style={{color:'#ffd740',fontSize:'12px'}}>⚠ 데이터 15분 초과</span>}
          <div style={{display:'flex',gap:'6px'}}>
            <span style={{background:ms.usStatus==='개장중'?'#00e67622':'#ff525222',border:`1px solid ${ms.usColor}44`,color:ms.usColor,padding:'3px 10px',borderRadius:'4px'}}>🇺🇸 US {ms.usStatus}</span>
            <span style={{background:ms.krStatus==='개장중'?'#00e67622':'#1a2535',color:ms.krStatus==='개장중'?'#00e676':'#8ea5b0',padding:'3px 10px',borderRadius:'4px'}}>🇰🇷 KR {ms.krStatus}</span>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontWeight:'bold',fontSize:'17px',color:'#40c4ff',fontVariantNumeric:'tabular-nums',letterSpacing:'1px'}}>{nowT.toLocaleTimeString('ko-KR',{hour12:false})}</div>
            <div style={{fontSize:'11px',color:'#607d8b'}}>{nowT.toLocaleDateString('ko-KR')} KST</div>
          </div>
          {updTime&&<div style={{fontSize:'11px',color:'#00e676',textAlign:'right'}}><div>● 데이터 기준</div><div>{updTime}</div></div>}
          {loading&&<Spinner s={16}/>}
        </div>
      </div>


      <div style={{padding:'12px 16px',maxWidth:'1900px',margin:'0 auto'}}>

        {loading&&(
          <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',padding:'30px',textAlign:'center',marginBottom:'12px'}}>
            <Spinner s={28}/><br/><br/>
            <div style={{color:'#b0c4cc',fontSize:'15px'}}>데이터 로딩 중...</div>
          </div>
        )}

        {/* ── 상단: 주요지수 + 섹터ETF 같은 라인 ────────────────────── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px',alignItems:'start'}}>
          {/* 주요 지수 */}
          <div>
            <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>
              📊 주요 지수 <span style={{color:'#607d8b',letterSpacing:'0'}}>· yfinance 10분 갱신</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
              {IDX_META.map(m=>{
                const q=quotes[m.yf]; const c=clr(q?.changePct??0);
                const p52=q&&q.high52w&&q.low52w&&q.high52w!==q.low52w
                  ?((q.price-q.low52w)/(q.high52w-q.low52w))*100:null;
                const fromATH=q?((m.ath-q.price)/m.ath*100):null;
                return (
                  <div key={m.yf} style={{background:'#0d1b2e',border:'1px solid #1a3050',borderLeft:`3px solid ${c}`,borderRadius:'6px',padding:'7px 8px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                      <span style={{fontSize:'10px',color:'#8ea5b0',fontWeight:'600',letterSpacing:'1px'}}>{m.sym}</span>
                      {loading||!q?<Spinner s={12}/>:
                        <span style={{fontSize:'11px',fontWeight:'700',color:c}}>{q.changePct>=0?'▲':'▼'}{Math.abs(q.changePct).toFixed(2)}%</span>}
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                      <span style={{fontSize:'14px',fontWeight:'700',color:'#eceff1'}}>{loading||!q?'—':fmt(q.price)}</span>
                      {fromATH!=null&&<span style={{fontSize:'9px',color:'#607d8b'}}>ATH -{fromATH.toFixed(1)}%</span>}
                    </div>
                    {p52!=null&&(
                      <div style={{height:'3px',background:'#1a2535',borderRadius:'2px'}}>
                        <div style={{height:'100%',width:`${Math.min(100,p52)}%`,background:p52<20?'#00e676':p52>80?'#ff5252':'#40c4ff',borderRadius:'2px'}}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* 섹터 ETF & 종목 */}
          <div>
            <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>🔥 섹터 ETF & 종목 <span style={{color:'#607d8b',letterSpacing:'0'}}>· yfinance 실제 등락률</span></div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px'}}>
              {SECTOR_DEF.map(d=><SectorCard key={d.yf} def={d} quotes={quotes} loading={loading}/>)}
            </div>
          </div>
        </div>

        {/* ── 메인: 좌(투자자+분석+캘린더) / 우(탭패널) ─────────────── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 500px',gap:'12px',alignItems:'start'}}>

          {/* 좌열 */}
          <div>
            {/* 투자자별 순매수 */}
            <InvestorTradingPanel data={mdata?.investorTrading}/>

            {/* 시장 분석 & ETF 추천 */}
            <MarketAnalysis quotes={quotes} fg={fg} loading={loading}/>

            {/* 캘린더 */}
            <div style={{marginTop:'10px'}}>
              <div style={{fontSize:'11px',letterSpacing:'2px',color:'#40c4ff',marginBottom:'8px'}}>📅 경제 캘린더</div>
              <GoogleCalendar events={CALENDAR} today={today}/>
            </div>
          </div>

          {/* 우열: 탭패널 */}
          <div style={{position:'sticky',top:'58px'}}>
            <div style={{background:'#0d1b2e',border:'1px solid #1a3050',borderRadius:'8px',overflow:'hidden'}}>
            {/* 탭 바 */}
            <div style={{display:'flex',borderBottom:'1px solid #1a2535',background:'#060d1a',overflowX:'auto'}}>
              <button style={tabS('news')}    onClick={()=>setTab('news')}>📰 뉴스</button>
              <button style={tabS('coin')}    onClick={()=>setTab('coin')}>₿ 코인</button>
              <button style={tabS('forex')}   onClick={()=>setTab('forex')}>💱 환율</button>
              <button style={tabS('com')}     onClick={()=>setTab('com')}>🪙 원자재</button>
              <button style={tabS('outlook')} onClick={()=>setTab('outlook')}>🔮 예상</button>
            </div>

            <div style={{padding:'10px',maxHeight:'calc(100vh - 130px)',overflowY:'auto'}}>
              {/* 뉴스 */}
              {tab==='news'&&(
                <div>
                  <div style={{display:'flex',gap:'4px',marginBottom:'8px',flexWrap:'wrap',alignItems:'center'}}>
                    {[['all','전체'],['trump','트럼프'],['macro','매크로'],['tech','테크'],['crypto','코인'],['korea','한국'],['energy','에너지'],['earnings','실적']].map(([k,l])=>(
                      <button key={k} style={fBtnS(k)} onClick={()=>setNF(k)}>{l}</button>
                    ))}
                    <span style={{marginLeft:'auto',fontSize:'10px',color:news.length?'#00e676':'#8ea5b0'}}>
                      {news.length?`● ${news.length}건`:'로딩 중...'}
                    </span>
                  </div>
                  <div>
                    {filteredNews.length===0&&<div style={{textAlign:'center',color:'#607d8b',padding:'30px',fontSize:'13px'}}>뉴스 없음</div>}
                    {filteredNews.map((item:any)=>{
                      const SC={positive:'#00e676',negative:'#ff5252',neutral:'#ffd740'} as const;
                      const SI={positive:'↑ 호재',negative:'↓ 악재',neutral:'→ 중립'} as const;
                      return (
                        <div key={item.id} style={{borderBottom:'1px solid #1a2535',marginBottom:'8px',padding:'6px',background:item.isTrump?'rgba(255,82,82,.03)':'transparent',borderRadius:'4px'}}>
                          <div style={{display:'flex',gap:'5px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                            {item.isTrump&&<span style={{fontSize:'10px',background:'rgba(255,82,82,.2)',color:'#ff8a80',padding:'1px 4px',borderRadius:'3px'}}>🎭 트럼프</span>}
                            <span style={{fontSize:'10px',color:SC[item.sentiment as keyof typeof SC],background:SC[item.sentiment as keyof typeof SC]+'22',padding:'1px 4px',borderRadius:'3px'}}>{SI[item.sentiment as keyof typeof SI]}</span>
                            <span style={{fontSize:'10px',color:'#607d8b',marginLeft:'auto'}}>{item.source} · {item.time}</span>
                          </div>
                          <a href={item.url} target="_blank" rel="noreferrer" style={{textDecoration:'none'}}>
                            <div style={{fontSize:'13px',color:'#cfd8dc',lineHeight:'1.5',cursor:'pointer'}}
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

              {/* 코인 */}
              {tab==='coin'&&(
                <div>
                  <div style={{fontSize:'10px',color:'#00e676',marginBottom:'8px'}}>● CoinGecko 실시간</div>
                  {crypto.length===0&&<div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner s={20}/></div>}
                  {crypto.map((c:any)=>(
                    <div key={c.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 0',borderBottom:'1px solid #1a2535'}}>
                      <div style={{width:'22px',height:'22px',borderRadius:'50%',background:'#1a2535',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',color:'#ffd740',fontWeight:'bold',flexShrink:0}}>{c.symbol.toUpperCase().slice(0,2)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:'13px',color:'#eceff1',fontWeight:'600'}}>{c.name}</div>
                        <div style={{fontSize:'10px',color:'#607d8b'}}>{fmtCap(c.market_cap)}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:'14px',color:'#f1f5f9',fontWeight:'700'}}>${c.current_price.toLocaleString()}</div>
                        <div style={{fontSize:'11px',color:clr(c.price_change_percentage_24h),fontWeight:'600'}}>{c.price_change_percentage_24h>=0?'▲':'▼'}{Math.abs(c.price_change_percentage_24h).toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 환율 */}
              {tab==='forex'&&(
                <div>
                  <div style={{fontSize:'10px',color:'#00e676',marginBottom:'8px'}}>● Open ER API 실시간</div>
                  {usdKrw===0&&<div style={{display:'flex',justifyContent:'center',padding:'20px'}}><Spinner s={20}/></div>}
                  {usdKrw>0&&forexList.map(fx=>(
                    <div key={fx.pair} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1a2535'}}>
                      <div>
                        <span style={{fontSize:'14px',color:'#eceff1'}}>{fx.flag} {fx.pair}</span>
                        <span style={{fontSize:'11px',color:'#607d8b',marginLeft:'8px'}}>{fx.label}</span>
                      </div>
                      <div style={{fontSize:'16px',fontWeight:'700',color:'#f1f5f9'}}>₩{fmt(fx.r,1)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 원자재 */}
              {tab==='com'&&(
                <div>
                  <div style={{fontSize:'10px',color:'#00e676',marginBottom:'8px'}}>● yfinance 실시간</div>
                  {COM_META.map(m=>{
                    const q=quotes[m.yf];
                    return (
                      <div key={m.sym} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 0',borderBottom:'1px solid #1a2535'}}>
                        <span style={{fontSize:'17px',flexShrink:0}}>{m.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'13px',color:'#eceff1',fontWeight:'600'}}>{m.name}</div>
                          <div style={{fontSize:'10px',color:'#607d8b'}}>{m.unit}</div>
                        </div>
                        {loading||!q?<Spinner/>:
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontSize:'14px',color:'#f1f5f9',fontWeight:'700'}}>${fmt(q.price,['NG=F','HG=F'].includes(m.yf)?3:2)}</div>
                            <div style={{fontSize:'11px',color:clr(q.changePct),fontWeight:'600'}}>{q.changePct>=0?'▲':'▼'}{Math.abs(q.changePct).toFixed(2)}%</div>
                          </div>
                        }
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 예상 */}
              {tab==='outlook'&&<MarketOutlook quotes={quotes} fg={fg} news={news} loading={loading}/>}
            </div>
            </div>{/* 탭패널 box 닫기 */}
          </div>{/* 우열 sticky 닫기 */}
        </div>{/* 메인 2열 그리드 닫기 */}

        <div style={{borderTop:'1px solid #1a2535',marginTop:'12px',paddingTop:'10px',display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#607d8b',flexWrap:'wrap',gap:'6px'}}>
          <span>⚡ GitHub Actions 10분 갱신 (public repo → Actions 무료·무제한)</span>
          <span>📡 yfinance · CoinGecko · Open ER API · Alternative.me · RSS · deep-translator · pykrx</span>
          <span>⚠️ 투자 판단은 본인 책임 | © 2026 Market Terminal</span>
        </div>
      </div>
    </div>
  );
}
