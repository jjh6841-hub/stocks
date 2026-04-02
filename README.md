# Market Terminal — 종합 주식 대시보드

## 빠른 시작

### 옵션 A: 프론트엔드만 (백엔드 없이 즉시 실행)
`StockDashboard.tsx`를 React 프로젝트에 추가하면 바로 동작합니다.
- 암호화폐: CoinGecko API 직접 호출 (무료, 실시간)
- 환율: Open ER API 직접 호출 (무료, 1시간 갱신)
- 주가/뉴스: 시뮬레이션 데이터

### 옵션 B: 백엔드 연동 (완전 실시간)

**1. 백엔드 실행**
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env       # API 키 입력 (선택사항)
uvicorn main:app --reload --port 8000
```

**2. 프론트엔드 백엔드 연동 활성화**
`StockDashboard.tsx` 상단의 `USE_BACKEND`를 `true`로 변경:
```tsx
const USE_BACKEND = true;  // ← 이 줄 변경
```

---

## 데이터 소스 및 지연시간

| 데이터      | 소스                    | 지연    | 비용  |
|------------|------------------------|--------|------|
| 암호화폐    | CoinGecko API          | 실시간  | 무료  |
| 환율        | Open ER API            | 1시간   | 무료  |
| 해외주가    | yfinance               | 15~20분 | 무료  |
| 뉴스        | RSS (Reuters/BBC/CNBC) | 5~15분  | 무료  |
| 뉴스(보강)  | NewsAPI                | 5~15분  | 무료* |
| 경제캘린더  | Finnhub                | 1일     | 무료* |
| 차트        | TradingView 위젯       | 실시간  | 무료  |

*무료 API 키 필요 (`.env` 파일에 입력)

---

## 무료 API 키 발급

1. **NewsAPI** (뉴스 강화): https://newsapi.org — 무료 100req/day
2. **Finnhub** (경제캘린더): https://finnhub.io — 무료 60req/min

`.env` 파일에 입력:
```
NEWS_API_KEY=발급받은키
FINNHUB_API_KEY=발급받은키
```

---

## 주요 기능

- **주요 지수**: KOSPI, KOSDAQ, S&P500, NASDAQ, DOW, 니케이, 상해, DAX
- **52주 저점/고점 위치**: 기회구간 / 고점권 / 중간권 표시
- **공포&탐욕 지수**: CNN Fear & Greed 스타일 게이지
- **TradingView 차트**: RSI·MACD 포함 실시간 차트 (무료 위젯)
- **핫 섹터**: AI·테크 / 방산 / 반도체 / 바이오 / 에너지
- **트럼프 모니터**: 발언 유형별 시장 영향 패턴 분석
- **뉴스 키워드 하이라이트**: 트럼프/연준/금리 등 핵심 키워드 자동 강조
- **경제 캘린더**: FOMC, 실적, 경제지표, 옵션만기 일정
- **암호화폐**: BTC, ETH, SOL, XRP, BNB (CoinGecko 실시간)
- **환율**: USD·EUR·JPY·CNY·GBP → 원화
- **원자재**: 금, 은, WTI원유, 브렌트유, 천연가스, 구리
- **WebSocket**: 백엔드 연동 시 30초마다 실시간 push
- **알림 시스템**: 트럼프 발언 감지 시 팝업 알림
