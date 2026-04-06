#!/usr/bin/env python3
"""
GitHub Actions에서 10분마다 실행 → public/market-data.json 저장
CORS 없이 서버에서 직접 Yahoo Finance·CoinGecko 등 호출
"""
import json, os, sys, time
from datetime import datetime, timezone, timedelta

import requests
import yfinance as yf
import feedparser
from deep_translator import GoogleTranslator
try:
    from pykrx import stock as pkstock
    _HAS_PYKRX = True
except ImportError:
    _HAS_PYKRX = False

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'market-data.json')

# ── 심볼 정의 ────────────────────────────────────────────────
SYMBOLS = {
    '^KS11':     {'sym':'KOSPI',  'name':'KOSPI',      'type':'index', 'ath':3316.08},
    '^KQ11':     {'sym':'KOSDAQ', 'name':'KOSDAQ',     'type':'index', 'ath':1206.95},
    '^GSPC':     {'sym':'SPX',    'name':'S&P 500',    'type':'index', 'ath':6147.43},
    '^IXIC':     {'sym':'NDX',    'name':'NASDAQ',     'type':'index', 'ath':20204.58},
    '^DJI':      {'sym':'DJI',    'name':'DOW',        'type':'index', 'ath':45073.63},
    '^N225':     {'sym':'N225',   'name':'니케이225',   'type':'index', 'ath':42224.02},
    '000001.SS': {'sym':'SSEC',   'name':'상해종합',    'type':'index', 'ath':6124.04},
    '^GDAXI':    {'sym':'DAX',    'name':'DAX',        'type':'index', 'ath':23476.80},
    'GC=F':  {'sym':'GOLD',  'name':'금',      'type':'commodity','unit':'USD/oz',    'icon':'🥇'},
    'SI=F':  {'sym':'SILVER','name':'은',      'type':'commodity','unit':'USD/oz',    'icon':'🥈'},
    'CL=F':  {'sym':'WTI',   'name':'WTI원유', 'type':'commodity','unit':'USD/bbl',   'icon':'🛢️'},
    'BZ=F':  {'sym':'BRENT', 'name':'브렌트유','type':'commodity','unit':'USD/bbl',   'icon':'⛽'},
    'NG=F':  {'sym':'NG',    'name':'천연가스','type':'commodity','unit':'USD/MMBtu', 'icon':'🔥'},
    'HG=F':  {'sym':'CU',    'name':'구리',    'type':'commodity','unit':'USD/lb',    'icon':'🔶'},
    'XLK':  {'sym':'XLK',  'name':'AI·테크','type':'etf'},
    'ITA':  {'sym':'ITA',  'name':'방산',    'type':'etf'},
    'SOXX': {'sym':'SOXX', 'name':'반도체',  'type':'etf'},
    'IBB':  {'sym':'IBB',  'name':'바이오',  'type':'etf'},
    'XLE':  {'sym':'XLE',  'name':'에너지',  'type':'etf'},
    'NVDA': {'sym':'NVDA','name':'엔비디아',       'type':'stock'},
    'MSFT': {'sym':'MSFT','name':'마이크로소프트',  'type':'stock'},
    'GOOGL':{'sym':'GOOGL','name':'알파벳',        'type':'stock'},
    'LMT':  {'sym':'LMT', 'name':'록히드마틴',     'type':'stock'},
    'RTX':  {'sym':'RTX', 'name':'레이시온',       'type':'stock'},
    'TSM':  {'sym':'TSM', 'name':'TSMC',           'type':'stock'},
    'ASML': {'sym':'ASML','name':'ASML',           'type':'stock'},
    'AMD':  {'sym':'AMD', 'name':'AMD',            'type':'stock'},
    'MRNA': {'sym':'MRNA','name':'모더나',          'type':'stock'},
    'REGN': {'sym':'REGN','name':'리제네론',        'type':'stock'},
    'XOM':  {'sym':'XOM', 'name':'엑슨모빌',       'type':'stock'},
    'CVX':  {'sym':'CVX', 'name':'쉐브론',         'type':'stock'},
    '000660.KS':{'sym':'000660','name':'SK하이닉스',        'type':'stock'},
    '012450.KS':{'sym':'012450','name':'한화에어로스페이스', 'type':'stock'},
    '047810.KS':{'sym':'047810','name':'한국항공우주',      'type':'stock'},
    '005930.KS':{'sym':'005930','name':'삼성전자',          'type':'stock'},
    '207940.KS':{'sym':'207940','name':'삼성바이오로직스',  'type':'stock'},
    '068270.KS':{'sym':'068270','name':'셀트리온',          'type':'stock'},
    '096770.KS':{'sym':'096770','name':'SK이노베이션',      'type':'stock'},
}

TRUMP_KW = ['trump','tariff','trade war','white house','truth social','관세','트럼프']
ALERT_KW = ['fed','fomc','interest rate','cpi','inflation','recession','war','crash','금리','연준']

def score(title: str):
    t = title.lower()
    is_trump = any(k in t for k in TRUMP_KW)
    neg = sum(1 for k in ['fall','drop','crash','plunge','fear','war','sanction','하락','급락','위기'] if k in t)
    pos = sum(1 for k in ['rise','rally','surge','gain','record','상승','급등','호재'] if k in t)
    cat = 'trump' if is_trump else \
          'crypto' if any(k in t for k in ['bitcoin','crypto','btc','eth','코인']) else \
          'tech' if any(k in t for k in ['nvidia','semiconductor','반도체','tsmc','hbm']) else \
          'energy' if any(k in t for k in ['oil','crude','opec','원유']) else \
          'korea' if any(k in t for k in ['kospi','samsung','삼성','korea','한국']) else \
          'earnings' if any(k in t for k in ['earnings','실적','revenue']) else 'macro'
    sentiment = 'negative' if neg > pos else 'positive' if pos > neg else 'neutral'
    sc = (40 if is_trump else 0) + neg * 5 + pos * 3 + sum(10 for k in ALERT_KW if k in t)
    return {'category': cat, 'sentiment': sentiment, 'isTrump': is_trump, 'score': sc}


def fetch_quotes():
    result = {}
    syms = list(SYMBOLS.keys())
    BATCH = 15
    for i in range(0, len(syms), BATCH):
        batch = syms[i:i+BATCH]
        try:
            raw = yf.download(batch, period='1y', interval='1d',
                              progress=False, auto_adjust=True,
                              group_by='ticker' if len(batch)>1 else None)
            for sym in batch:
                try:
                    hist = raw[sym] if len(batch) > 1 else raw
                    closes = hist['Close'].dropna()
                    if len(closes) < 2:
                        continue
                    cur  = float(closes.iloc[-1])
                    prev = float(closes.iloc[-2])
                    chg  = cur - prev
                    pct  = chg / prev * 100 if prev else 0
                    highs = hist['High'].dropna()
                    lows  = hist['Low'].dropna()
                    result[sym] = {
                        **SYMBOLS.get(sym, {}),
                        'price':     round(cur, 4),
                        'change':    round(chg, 4),
                        'changePct': round(pct, 4),
                        'high52w':   round(float(highs.max()), 4) if not highs.empty else 0,
                        'low52w':    round(float(lows.min()), 4)  if not lows.empty else 0,
                    }
                    print(f"  ✓ {sym}: {cur:.2f} ({pct:+.2f}%)", file=sys.stderr)
                except Exception as e:
                    print(f"  ✗ {sym}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"  Batch error [{i}]: {e}", file=sys.stderr)
        time.sleep(1)
    return result


def fetch_crypto():
    try:
        r = requests.get(
            'https://api.coingecko.com/api/v3/coins/markets'
            '?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,binancecoin'
            '&order=market_cap_desc&price_change_percentage=24h', timeout=15)
        return r.json() if r.ok else []
    except Exception as e:
        print(f"Crypto: {e}", file=sys.stderr); return []


def fetch_forex():
    try:
        r = requests.get('https://open.er-api.com/v6/latest/USD', timeout=10)
        return r.json().get('rates', {}) if r.ok else {}
    except Exception as e:
        print(f"Forex: {e}", file=sys.stderr); return {}


def fetch_fear_greed():
    try:
        r = requests.get('https://api.alternative.me/fng/?limit=1', timeout=8)
        if r.ok:
            d = r.json()['data'][0]
            return {'value': int(d['value']), 'label': d['value_classification']}
    except Exception as e:
        print(f"F&G: {e}", file=sys.stderr)
    return {'value': 35, 'label': 'Fear'}


_translator = GoogleTranslator(source='auto', target='ko')

def is_korean(text: str) -> bool:
    return any('\uAC00' <= c <= '\uD7A3' for c in text)

def translate_title(title: str) -> str:
    if is_korean(title):
        return title
    try:
        result = _translator.translate(title)
        return result if result else title
    except Exception as e:
        print(f"  번역 실패: {e}", file=sys.stderr)
        return title


def fetch_rss(url, source, n=7):
    items = []
    try:
        feed = feedparser.parse(url)
        for e in feed.entries[:n]:
            title_orig = (e.get('title') or '').strip()
            if not title_orig: continue
            pub = e.get('published_parsed')
            if pub:
                from time import mktime
                dt = datetime.fromtimestamp(mktime(pub), tz=timezone.utc)
                d = int((datetime.now(timezone.utc) - dt).total_seconds() / 60)
                t = f'{d}분 전' if d < 60 else f'{d//60}시간 전' if d < 1440 else dt.strftime('%m/%d')
            else:
                t = '—'
            meta = score(title_orig)
            title_ko = translate_title(title_orig)
            items.append({'id': abs(hash(title_orig)) % 10_000_000,
                          'title': title_ko, 'titleOrig': title_orig,
                          'source': source, 'time': t,
                          'url': e.get('link','#'), **meta})
    except Exception as ex:
        print(f"RSS {source}: {ex}", file=sys.stderr)
    return items


def fetch_investor_trading():
    """KRX 공개 API 직접 호출 (pykrx 우회 — 해외 IP 대응)"""

    # KST 기준 최근 평일 5개
    kst_now = datetime.now(timezone.utc) + timedelta(hours=9)
    candidate_dates = []
    for delta in range(1, 14):
        dt = kst_now - timedelta(days=delta)
        if dt.weekday() < 5:
            candidate_dates.append(dt.strftime('%Y%m%d'))
        if len(candidate_dates) >= 5:
            break

    # KRX MDCSTAT02401: 투자자별 순매수 상위종목
    # invstTpCd 코드: 외국인합계=9000, 기관합계=9100, 연기금등=9200, 개인=1000
    KRX_URL = 'http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd'
    KRX_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer':    'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020302',
        'Origin':     'http://data.krx.co.kr',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
    }

    investor_codes = {
        '외국인': '9000',
        '기관':   '9100',
        '연기금': '9200',
        '개인':   '1000',
    }

    def _krx_fetch(date_str, inv_code):
        payload = {
            'bld':          'dbms/MDC/STAT/standard/MDCSTAT02401',
            'locale':       'ko_KR',
            'mktId':        'STK',
            'invstTpCd':    inv_code,
            'strtDd':       date_str,
            'endDd':        date_str,
            'share':        '1',
            'money':        '1',
            'csvxls_isNo':  'false',
        }
        r = requests.post(KRX_URL, data=payload, headers=KRX_HEADERS, timeout=20)
        if not r.ok:
            print(f"      HTTP {r.status_code}", file=sys.stderr)
            return None
        items = r.json().get('output', [])
        if not items:
            return None
        # 필드명: ISU_ABBRV=종목명, ISU_CD=코드, NETBUY_TRDVAL=순매수거래대금
        def to_int(v):
            try: return int(str(v).replace(',',''))
            except: return 0
        rows = [{'code': it.get('ISU_CD',''), 'name': it.get('ISU_ABBRV',''),
                 'val': to_int(it.get('NETBUY_TRDVAL', 0))} for it in items]
        rows.sort(key=lambda x: x['val'], reverse=True)
        return {
            'buy':  [{'code':r['code'],'name':r['name'],'amount': r['val']}
                      for r in rows if r['val']>0][:10],
            'sell': [{'code':r['code'],'name':r['name'],'amount': abs(r['val'])}
                      for r in rows if r['val']<0][-10:][::-1],
        }

    for date_str in candidate_dates:
        print(f"  KRX 투자자 시도: {date_str}", file=sys.stderr)
        result = {}
        for label, code in investor_codes.items():
            try:
                entry = _krx_fetch(date_str, code)
                if entry and (entry['buy'] or entry['sell']):
                    result[label] = entry
                    print(f"    ✓ {label}: buy={len(entry['buy'])}, sell={len(entry['sell'])}", file=sys.stderr)
                else:
                    print(f"    - {label}: empty", file=sys.stderr)
            except Exception as e:
                print(f"    ✗ {label}: {e}", file=sys.stderr)

        if result:
            return {'date': date_str, 'data': result}

    print("  KRX 투자자 거래: 모든 후보일 실패", file=sys.stderr)
    return {}


def main():
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"Market data fetch: {datetime.now().isoformat()}", file=sys.stderr)

    quotes   = fetch_quotes()
    crypto   = fetch_crypto()
    forex    = fetch_forex()
    fg       = fetch_fear_greed()
    investor = fetch_investor_trading()

    news = []
    for url, src in [
        ('https://feeds.reuters.com/reuters/businessNews',                                                          'Reuters'),
        ('https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',                   'CNBC'),
        ('https://feeds.bbci.co.uk/news/business/rss.xml',                                                        'BBC'),
        ('https://news.google.com/rss/search?q=trump+tariff+trade&hl=en&gl=US&ceid=US:en',                       'Google/트럼프'),
        ('https://news.google.com/rss/search?q=fed+interest+rate+inflation&hl=en&gl=US&ceid=US:en',              'Google/Fed'),
        ('https://news.google.com/rss/search?q=kospi+samsung+반도체&hl=ko&gl=KR&ceid=KR:ko',                    'Google/한국'),
    ]:
        news.extend(fetch_rss(url, src))

    seen, uniq = set(), []
    for n in sorted(news, key=lambda x: -x['score']):
        if n['id'] not in seen:
            seen.add(n['id']); uniq.append(n)

    data = {
        'updatedAt':       datetime.now(timezone.utc).isoformat(),
        'quotes':          quotes,
        'crypto':          crypto,
        'forex':           forex,
        'fearGreed':       fg,
        'news':            uniq[:30],
        'investorTrading': investor,
    }

    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(quotes)} quotes, {len(crypto)} coins, {len(uniq)} news → {OUT}", file=sys.stderr)


if __name__ == '__main__':
    main()
