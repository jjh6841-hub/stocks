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
    """투자자별 순매수/순매도 TOP10 — KRX OTP → Naver Finance 순으로 시도"""

    UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

    # KST 기준 최근 평일 3개
    kst_now = datetime.now(timezone.utc) + timedelta(hours=9)
    candidate_dates = []
    for delta in range(1, 14):
        dt = kst_now - timedelta(days=delta)
        if dt.weekday() < 5:
            candidate_dates.append(dt.strftime('%Y%m%d'))
        if len(candidate_dates) >= 3:
            break

    # ── 전략 1: KRX OTP 파일 다운로드 ─────────────────────────
    try:
        result = _krx_otp_download(candidate_dates, UA)
        if result:
            print(f"  ✓ KRX OTP 성공: {result.get('date')}", file=sys.stderr)
            return result
    except Exception as e:
        print(f"  KRX OTP 전략 오류: {e}", file=sys.stderr)

    # ── 전략 2: Naver Finance 스크래핑 ───────────────────────
    try:
        result = _naver_investor(candidate_dates, UA)
        if result:
            print(f"  ✓ Naver 스크래핑 성공", file=sys.stderr)
            return result
    except Exception as e:
        print(f"  Naver 전략 오류: {e}", file=sys.stderr)

    print("  투자자 거래: 모든 소스 실패", file=sys.stderr)
    return {}


def _krx_otp_download(dates, UA):
    """KRX OTP 시스템: GenerateOTP → file.krx.co.kr/download.cmd"""
    import io, csv as csvmod
    OTP_URL = 'http://data.krx.co.kr/contents/COM/GenerateOTP.cmd'
    DL_URL  = 'http://file.krx.co.kr/download.cmd'
    HDR = {
        'User-Agent': UA,
        'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020302',
    }
    inv_codes = {'외국인':'9000','기관':'9100','연기금':'9200','개인':'1000'}

    for date_str in dates:
        print(f"  KRX OTP 시도: {date_str}", file=sys.stderr)
        inv_result = {}

        for label, code in inv_codes.items():
            otp_params = {
                'name': 'fileDown',
                'url':  'dbms/MDC/STAT/standard/MDCSTAT02401',
                'locale':       'ko_KR',
                'mktId':        'STK',
                'invstTpCd':    code,
                'strtDd':       date_str,
                'endDd':        date_str,
                'share':        '1',
                'money':        '1',
                'csvxls_isNo':  'true',
            }
            try:
                r_otp = requests.post(OTP_URL, data=otp_params, headers=HDR, timeout=15)
                otp = r_otp.text.strip()
                print(f"    OTP {label}: status={r_otp.status_code} val={otp[:40]!r}", file=sys.stderr)

                if 'LOGOUT' in otp or len(otp) < 10:
                    print(f"    → geo-blocked, 전략1 중단", file=sys.stderr)
                    return None  # 해외 IP 차단 → 다음 전략으로

                r_dl = requests.post(DL_URL, data={'code': otp}, headers=HDR, timeout=20)
                print(f"    DL {label}: status={r_dl.status_code} len={len(r_dl.content)}", file=sys.stderr)

                if not r_dl.ok or len(r_dl.content) < 100:
                    continue

                # CSV 파싱 (EUC-KR 인코딩)
                try:
                    text = r_dl.content.decode('euc-kr', errors='replace')
                    reader = csvmod.DictReader(io.StringIO(text))
                    rows = list(reader)
                    if not rows:
                        continue
                    keys = list(rows[0].keys())
                    print(f"    CSV {label}: {len(rows)} rows | cols={keys[:6]}", file=sys.stderr)

                    # 컬럼 자동 탐지
                    def find_col(keywords, row_keys):
                        for kw in keywords:
                            for k in row_keys:
                                if kw in k:
                                    return k
                        return None

                    net_col  = find_col(['순매수거래대금','순매수금액','순매수'], keys)
                    name_col = find_col(['종목명','ISU_ABBRV','종목 명'], keys)
                    code_col = find_col(['단축코드','종목코드','ISU_SRT_CD','ISU_CD'], keys)

                    if not (net_col and name_col):
                        print(f"    컬럼 탐지 실패: net={net_col} name={name_col}", file=sys.stderr)
                        continue

                    def to_int(v):
                        try: return int(str(v).replace(',','').strip())
                        except: return 0

                    parsed = [{'code': r.get(code_col,''), 'name': r.get(name_col,'').strip(),
                               'val': to_int(r.get(net_col, 0))} for r in rows if r.get(name_col)]
                    parsed.sort(key=lambda x: x['val'], reverse=True)
                    inv_result[label] = {
                        'buy':  [{'code': x['code'], 'name': x['name'], 'amount':  x['val']}
                                 for x in parsed if x['val'] > 0][:10],
                        'sell': [{'code': x['code'], 'name': x['name'], 'amount': -x['val']}
                                 for x in reversed(parsed) if x['val'] < 0][:10],
                    }
                    print(f"    ✓ {label}: buy={len(inv_result[label]['buy'])} sell={len(inv_result[label]['sell'])}", file=sys.stderr)
                except Exception as e:
                    print(f"    CSV 파싱 오류 {label}: {e}", file=sys.stderr)

            except Exception as e:
                print(f"    OTP 요청 오류 {label}: {e}", file=sys.stderr)

        if inv_result:
            return {'date': date_str, 'data': inv_result}

    return None


def _naver_investor(dates, UA):
    """Naver Finance 스크래핑 — 외국인/기관 순매수 상위"""
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("  beautifulsoup4 없음 — Naver 스크래핑 불가", file=sys.stderr)
        return None

    HDR = {
        'User-Agent': UA,
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://finance.naver.com/',
    }

    # Naver Finance 투자자별 순매수 페이지
    # tp_cd: 4=외국인순매수, 3=기관순매수, 5=개인순매수  (sosok: 0=KOSPI, 1=KOSDAQ)
    tp_map = {'외국인': '4', '기관': '3', '개인': '5'}
    inv_result = {}

    for label, tp_cd in tp_map.items():
        for sosok, market in [('0', 'KOSPI')]:
            url = f'https://finance.naver.com/sise/sise_quant.nhn?sosok={sosok}&tp_cd={tp_cd}'
            try:
                r = requests.get(url, headers=HDR, timeout=12)
                r.encoding = 'euc-kr'
                print(f"  Naver {label} ({market}): status={r.status_code} len={len(r.text)}", file=sys.stderr)

                soup = BeautifulSoup(r.text, 'lxml')
                table = soup.find('table', class_='type_2')
                if not table:
                    print(f"  Naver {label}: 테이블 없음", file=sys.stderr)
                    continue

                rows = table.find_all('tr')
                entries = []
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) < 7:
                        continue
                    a_tag = row.find('a', href=lambda h: h and 'code=' in h)
                    if not a_tag:
                        continue
                    href = a_tag.get('href', '')
                    code = href.split('code=')[-1].strip() if 'code=' in href else ''
                    name = a_tag.text.strip()

                    # tp_cd=4(외국인순매수)일 때 순매수 수량이 특정 컬럼에 위치
                    # 컬럼 구조: 종목명|현재가|전일비|등락률|거래대금|외국인비율|[순매수수량]
                    try:
                        # 마지막에서 두 번째 td가 순매수 관련값인 경우가 많음
                        amt_text = cols[-2].text.strip().replace(',', '').replace('+', '').replace('-', '')
                        amount = int(amt_text) if amt_text.isdigit() else 0
                    except:
                        amount = 0

                    if name and code:
                        entries.append({'code': code, 'name': name, 'amount': amount})

                print(f"  Naver {label}: {len(entries)} entries", file=sys.stderr)
                if entries:
                    # 이미 순서대로 정렬돼 있음 (순매수 상위)
                    inv_result[label] = {
                        'buy':  entries[:10],
                        'sell': [],
                    }
            except Exception as e:
                print(f"  Naver {label} 오류: {e}", file=sys.stderr)

    if inv_result:
        date_str = dates[0] if dates else ''
        return {'date': date_str, 'data': inv_result, 'note': 'Naver Finance 기준'}

    # 마지막 수단: 외국인 순매수 잔고 상위 (frgn_invest)
    try:
        r = requests.get('https://finance.naver.com/sise/frgn_invest.nhn?sosok=0', headers=HDR, timeout=12)
        r.encoding = 'euc-kr'
        soup = BeautifulSoup(r.text, 'lxml')
        table = soup.find('table', class_='type_2')
        if table:
            entries = []
            for row in table.find_all('tr'):
                cols = row.find_all('td')
                if len(cols) < 5:
                    continue
                a_tag = row.find('a', href=lambda h: h and 'code=' in h)
                if not a_tag:
                    continue
                code = a_tag['href'].split('code=')[-1].strip()
                name = a_tag.text.strip()
                try:
                    amt = int(cols[4].text.strip().replace(',', ''))
                except:
                    amt = 0
                if name:
                    entries.append({'code': code, 'name': name, 'amount': amt})
            if entries:
                date_str = dates[0] if dates else ''
                return {
                    'date': date_str,
                    'note': '외국인 순매수잔고 기준',
                    'data': {'외국인': {'buy': entries[:10], 'sell': []}},
                }
    except Exception as e:
        print(f"  Naver frgn_invest 오류: {e}", file=sys.stderr)

    return None


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
