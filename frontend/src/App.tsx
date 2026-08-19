import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import Landing from '@/routes/marketing/Landing';
import Burn from '@/routes/owner/Burn';
import Quote from '@/routes/owner/Quote';
import Asset from '@/routes/owner/Asset';
import Wrapped from '@/routes/owner/Wrapped';
import Applications from '@/routes/bank/Applications';
import CreditFile from '@/routes/bank/CreditFile';
import Portfolio from '@/routes/bank/Portfolio';
import DemoControl from '@/routes/demo/DemoControl';
import NotFound from '@/routes/NotFound';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipProvider delayDuration={200}>
        <ToastProvider swipeDirection="right">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/burn" element={<Burn />} />
            <Route path="/quote/:id" element={<Quote />} />
            <Route path="/asset/:id" element={<Asset />} />
            <Route path="/wrapped/:id" element={<Wrapped />} />
            <Route path="/bank" element={<Applications />} />
            <Route path="/bank/file/:id" element={<CreditFile />} />
            <Route path="/bank/portfolio" element={<Portfolio />} />
            <Route path="/demo" element={<DemoControl />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}
