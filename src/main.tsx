import React from 'react'
import ReactDOM from 'react-dom/client'
import StockDashboard from '../StockDashboard'
import MobileDashboard from '../MobileDashboard'

function App() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile ? <MobileDashboard /> : <StockDashboard />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
