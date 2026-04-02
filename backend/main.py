"""
Market Terminal - FastAPI Backend
==================================
무료 API로 실시간 금융 데이터 집계 서버

실행 방법:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

환경변수 (.env 파일 설정):
  NEWS_API_KEY=your_key_here      (https://newsapi.org - 무료)
  FINNHUB_API_KEY=your_key_here   (https://finnhub.io - 무료)
"""

import asyncio
import json
import os
import time
import re
from datetime import datetime, timedelta
from typing import Dict, List, Set, Any, Optional

import aiohttp
import feedparser
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY    = os.getenv("NEWS_API_KEY", "")
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")

# ─── 트럼프 / 핵심 키워드 (뉴스 중요도 판단용) ───────────────────────────
TRUMP_KEYWORDS = [
    "trump", "트럼프", "tariff", "관세", "tariffs",
    "trade war", "무역전쟁", "executive order", "행정명령",
    "white house", "백악관", "truth social", "biden",
]
HIGH_IMPORTANCE_KEYWORDS = [
    "fed", "연준", "fomc", "interest rate", "금리", "rate cut", "rate hike",
    "cpi", "inflation", "인플레이션", "recession", "경기침체",
    "semiconductor", "반도체", "nvidia", "samsung", "삼성", "hbm",
    "bitcoin", "비트코인", "crypto", "btc",
    "war", "전쟁", "nuclear", "핵", "sanction", "제재",
    "opec", "crude oil", "원유", "gold", "금값",
    "earnings", "실적", "ipo", "bankruptcy", "파산",
    "china", "중국", "korea", "한국", "north korea", "북한",
]

# ─── 캐시 ─────────────────────────────────────────────────────────────────
_cache: Dict[str, Any] = {}
_cache_ts: Dict[str, float] = {}

async def cached(key: str, ttl: int, fetcher):
    now = time.time()
    if key in _cache and (now - _cache_ts.get(key, 0)) < ttl:
        return _cache[key]
    try:
        data = await fetcher()
        if data is not None:
            _cache[key] = data
            _cache_ts[key] = now
    except Exception as e:
        print(f"[cache] fetch error ({key}): {e}")
    return _cache.get(key)

# ─── WebSocket 관리 ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        print(f"[ws] connected  (total={len(self.active)})")

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        print(f"[ws] disconnected (total={len(self.active)})")

    async def broadcast(self, payload: dict):
        dead: Set[WebSocket] = set()
        msg = json.dumps(payload)
        for ws in list(self.active):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        self.active -= dead

manager = ConnectionManager()

# ─── 앱 ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Market Terminal API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════
# DATA FETCHERS
# ═══════════════════════════════════════════════════════════════════════════

async def _fetch_crypto() -> List[dict]:
    """CoinGecko 암호화폐 - 무료, API 키 불필요"""
    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        "?vs_currency=usd"
        "&ids=bitcoin,ethereum,solana,ripple,binancecoin,dogecoin"
        "&order=market_cap_desc&sparkline=false&price_change_percentage=24h"
    )
    async with aiohttp.ClientSession() as s:
        async with s.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            return await r.json()

async def _fetch_forex() -> dict:
    """Open Exchange Rates - 무료"""
    async with aiohttp.ClientSession() as s:
        async with s.get("https://open.er-api.com/v6/latest/USD", timeout=aiohttp.ClientTimeout(total=10)) as r:
            d = await r.json()
            return d.get("rates", {})

async def _fetch_stocks_yfinance() -> List[dict]:
    """yfinance - 15~20분 지연, 무료"""
    import yfinance as yf
    symbols = {
        "^GSPC":    {"name": "S&P 500",   "symbol": "SPX"},
        "^IXIC":    {"name": "NASDAQ",    "symbol": "NDX"},
        "^DJI":     {"name": "DOW",       "symbol": "DJI"},
        "^KS11":    {"name": "KOSPI",     "symbol": "KOSPI"},
        "^KQ11":    {"name": "KOSDAQ",    "symbol": "KOSDAQ"},
        "^N225":    {"name": "니케이225",  "symbol": "N225"},
        "000001.SS":{"name": "상해종합",   "symbol": "SSEC"},
        "^GDAXI":   {"name": "DAX",       "symbol": "DAX"},
        "GC=F":     {"name": "금 선물",    "symbol": "GOLD"},
        "CL=F":     {"name": "WTI 원유",   "symbol": "WTI"},
    }
    results = []
    loop = asyncio.get_event_loop()
    def fetch_sync():
        out = []
        for yf_sym, meta in symbols.items():
            try:
                t = yf.Ticker(yf_sym)
                hist = t.history(period="5d", interval="1d")
                if hist.empty:
                    continue
                cur  = float(hist["Close"].iloc[-1])
                prev = float(hist["Close"].iloc[-2]) if len(hist) > 1 else cur
                chg  = cur - prev
                pct  = chg / prev * 100 if prev else 0
                out.append({
                    "yf_symbol": yf_sym,
                    "symbol": meta["symbol"],
                    "name": meta["name"],
                    "price": round(cur, 2),
                    "change": round(chg, 2),
                    "changePercent": round(pct, 2),
                    "delay": "15~20분 지연",
                })
            except Exception as e:
                print(f"[yfinance] {yf_sym}: {e}")
        return out
    return await loop.run_in_executor(None, fetch_sync)

def _score_news(title: str, content: str = "") -> dict:
    """뉴스 중요도 점수 및 카테고리 분류"""
    text = (title + " " + content).lower()
    is_trump   = any(kw in text for kw in TRUMP_KEYWORDS)
    is_high    = any(kw in text for kw in HIGH_IMPORTANCE_KEYWORDS)
    score = 0
    if is_trump:
        score += 40
        for kw in ["tariff", "관세", "trade", "무역"]:
            if kw in text:
                score += 10
    if is_high:
        score += 20

    # 카테고리 분류
    category = "macro"
    if is_trump:
        category = "trump"
    elif any(k in text for k in ["bitcoin","crypto","ethereum","solana","btc","eth","코인","암호화폐"]):
        category = "crypto"
    elif any(k in text for k in ["semiconductor","반도체","chip","nvidia","samsung","tsmc","hbm"]):
        category = "tech"
    elif any(k in text for k in ["oil","crude","opec","energy","원유","에너지","가스"]):
        category = "energy"
    elif any(k in text for k in ["korea","kospi","한국","삼성","현대","sk","lg","포스코"]):
        category = "korea"
    elif any(k in text for k in ["earnings","실적","revenue","profit","분기"]):
        category = "earnings"

    # 감성 분류 (단순 키워드 기반)
    neg_words = ["fall","drop","crash","decline","plunge","fear","recession","war","sanction","ban","하락","급락","폭락","위기","충격","우려"]
    pos_words = ["rise","rally","surge","gain","record","high","growth","상승","급등","호재","최고"]
    neg = sum(1 for w in neg_words if w in text)
    pos = sum(1 for w in pos_words if w in text)
    sentiment = "negative" if neg > pos else "positive" if pos > neg else "neutral"

    return {"score": score, "is_trump": is_trump, "category": category, "sentiment": sentiment}

async def _fetch_news_rss() -> List[dict]:
    """RSS 피드 파싱 - 무료, 5분마다 갱신"""
    RSS_FEEDS = [
        ("https://feeds.reuters.com/reuters/businessNews",          "Reuters"),
        ("https://feeds.bbci.co.uk/news/business/rss.xml",         "BBC Business"),
        ("https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", "CNBC Markets"),
        ("https://feeds.a.dj.com/rss/RSSMarketsMain.xml",          "WSJ Markets"),
        ("https://news.google.com/rss/search?q=trump+tariff&hl=en-US&gl=US&ceid=US:en", "Google/Trump"),
        ("https://news.google.com/rss/search?q=fed+interest+rate+2026&hl=en-US&gl=US&ceid=US:en", "Google/Fed"),
        ("https://news.google.com/rss/search?q=samsung+semiconductor+2026&hl=ko&gl=KR&ceid=KR:ko", "Google/Korea"),
    ]
    results = []
    loop = asyncio.get_event_loop()

    def parse_feeds():
        items = []
        for url, source_name in RSS_FEEDS:
            try:
                feed = feedparser.parse(url)
                for entry in feed.entries[:6]:
                    title = entry.get("title", "").strip()
                    if not title:
                        continue
                    meta = _score_news(title, entry.get("summary", ""))
                    pub = entry.get("published_parsed")
                    if pub:
                        dt = datetime(*pub[:6])
                        time_str = dt.strftime("%H:%M")
                    else:
                        time_str = "—"
                    items.append({
                        "id": hash(title) & 0xFFFFFF,
                        "title": title,
                        "source": source_name,
                        "time": time_str,
                        "url": entry.get("link", "#"),
                        "sentiment": meta["sentiment"],
                        "category": meta["category"],
                        "is_trump": meta["is_trump"],
                        "score": meta["score"],
                    })
            except Exception as e:
                print(f"[rss] {source_name}: {e}")
        # 중요도 높은 순 정렬, 최대 30개
        items.sort(key=lambda x: x["score"], reverse=True)
        return items[:30]

    return await loop.run_in_executor(None, parse_feeds)

async def _fetch_news_api(query: str = "stock market OR tariff OR fed OR bitcoin", lang="en") -> List[dict]:
    """NewsAPI - 무료 100req/day, API 키 필요"""
    if not NEWS_API_KEY:
        return []
    url = (
        f"https://newsapi.org/v2/everything"
        f"?q={query}&language={lang}&sortBy=publishedAt&pageSize=20"
        f"&apiKey={NEWS_API_KEY}"
    )
    async with aiohttp.ClientSession() as s:
        async with s.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            d = await r.json()
            articles = d.get("articles", [])
            results = []
            for a in articles:
                title = a.get("title", "")
                meta = _score_news(title, a.get("description", ""))
                results.append({
                    "id": hash(title) & 0xFFFFFF,
                    "title": title,
                    "source": a.get("source", {}).get("name", ""),
                    "time": a.get("publishedAt", "")[:16].replace("T", " "),
                    "url": a.get("url", "#"),
                    "sentiment": meta["sentiment"],
                    "category": meta["category"],
                    "is_trump": meta["is_trump"],
                    "score": meta["score"],
                })
            return sorted(results, key=lambda x: x["score"], reverse=True)

async def _fetch_fear_greed() -> Optional[dict]:
    """CNN Fear & Greed Index (alternative.me)"""
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get("https://api.alternative.me/fng/?limit=1", timeout=aiohttp.ClientTimeout(total=8)) as r:
                d = await r.json()
                item = d["data"][0]
                return {"value": int(item["value"]), "label": item["value_classification"]}
    except:
        return None

async def _fetch_calendar_finnhub() -> List[dict]:
    """Finnhub 경제 캘린더 - API 키 필요"""
    if not FINNHUB_API_KEY:
        return []
    today = datetime.now().strftime("%Y-%m-%d")
    end   = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    url = f"https://finnhub.io/api/v1/calendar/economic?from={today}&to={end}&token={FINNHUB_API_KEY}"
    async with aiohttp.ClientSession() as s:
        async with s.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
            d = await r.json()
            return d.get("economicCalendar", [])[:20]

# ═══════════════════════════════════════════════════════════════════════════
# REST ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/crypto")
async def get_crypto():
    return await cached("crypto", 30, _fetch_crypto)

@app.get("/api/forex")
async def get_forex():
    return await cached("forex", 3600, _fetch_forex)

@app.get("/api/stocks")
async def get_stocks():
    return await cached("stocks", 900, _fetch_stocks_yfinance)

@app.get("/api/news")
async def get_news(trump_only: bool = Query(False)):
    rss = await cached("news_rss", 300, _fetch_news_rss) or []
    api = await cached("news_api", 300, lambda: _fetch_news_api()) or []
    # 합치고 중복 제거 (id 기준)
    seen, merged = set(), []
    for item in rss + api:
        iid = item["id"]
        if iid not in seen:
            seen.add(iid)
            merged.append(item)
    merged.sort(key=lambda x: x["score"], reverse=True)
    if trump_only:
        merged = [n for n in merged if n["is_trump"]]
    return merged[:25]

@app.get("/api/fear-greed")
async def get_fear_greed():
    return await cached("fear_greed", 3600, _fetch_fear_greed) or {"value": 35, "label": "Fear"}

@app.get("/api/calendar")
async def get_calendar():
    return await cached("calendar", 86400, _fetch_calendar_finnhub)

@app.get("/api/health")
async def health():
    return {"status": "ok", "time": datetime.now().isoformat(), "connections": len(manager.active)}

# ═══════════════════════════════════════════════════════════════════════════
# WEBSOCKET  (실시간 push: crypto + forex, 30초마다)
# ═══════════════════════════════════════════════════════════════════════════

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # 연결 즉시 최신 데이터 전송
        crypto = await cached("crypto", 30, _fetch_crypto) or []
        forex  = await cached("forex", 3600, _fetch_forex) or {}
        fg     = await cached("fear_greed", 3600, _fetch_fear_greed) or {"value": 35}
        await ws.send_text(json.dumps({"type": "init", "crypto": crypto, "forex": forex, "fearGreed": fg}))
        # 클라이언트 ping 대기 (keep-alive)
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        print(f"[ws] error: {e}")
        manager.disconnect(ws)

# ═══════════════════════════════════════════════════════════════════════════
# BACKGROUND BROADCAST LOOP
# ═══════════════════════════════════════════════════════════════════════════

async def broadcast_loop():
    """30초마다 연결된 모든 클라이언트에 실시간 데이터 push"""
    while True:
        await asyncio.sleep(30)
        if not manager.active:
            continue
        try:
            crypto = await _fetch_crypto()
            forex  = await _fetch_forex()
            news   = await cached("news_rss", 300, _fetch_news_rss) or []
            trump_news = [n for n in news if n["is_trump"]]
            await manager.broadcast({
                "type": "update",
                "crypto": crypto,
                "forex": forex,
                "trump_alerts": trump_news[:3],
                "timestamp": datetime.now().isoformat(),
            })
            # 캐시 업데이트
            _cache["crypto"] = crypto
            _cache_ts["crypto"] = time.time()
            _cache["forex"] = forex
            _cache_ts["forex"] = time.time()
        except Exception as e:
            print(f"[broadcast] error: {e}")

@app.on_event("startup")
async def startup():
    asyncio.create_task(broadcast_loop())
    print("✅ Market Terminal API started")
    print(f"   NewsAPI key : {'✓ 있음' if NEWS_API_KEY else '✗ 없음 (.env 설정 필요)'}")
    print(f"   Finnhub key : {'✓ 있음' if FINNHUB_API_KEY else '✗ 없음 (.env 설정 필요)'}")
    print("   무료 소스   : CoinGecko, Open ER API, RSS 피드 (키 불필요)")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
