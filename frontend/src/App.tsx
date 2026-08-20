import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider, ToastViewport } from '@/components/ui/toast';
import RequireRole from '@/components/layout/RequireRole';
import Landing from '@/routes/marketing/Landing';
import Login from '@/routes/auth/Login';
import Dashboard from '@/routes/owner/Dashboard';
import Burn from '@/routes/owner/Burn';
import Quote from '@/routes/owner/Quote';
import Asset from '@/routes/owner/Asset';
import Wrapped from '@/routes/owner/Wrapped';
import Applications from '@/routes/bank/Applications';
import CreditFile from '@/routes/bank/CreditFile';
import Portfolio from '@/routes/bank/Portfolio';
import DemoControl from '@/routes/demo/DemoControl';
import Orchestrate from '@/routes/demo/Orchestrate';
import Terms from '@/routes/legal/Terms';
import NotFound from '@/routes/NotFound';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipProvider delayDuration={200}>
        <ToastProvider swipeDirection="right">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/app" element={<RequireRole role="owner"><Dashboard /></RequireRole>} />
            <Route path="/burn" element={<RequireRole role="owner"><Burn /></RequireRole>} />
            <Route path="/quote/:id" element={<RequireRole role="owner"><Quote /></RequireRole>} />
            <Route path="/asset/:id" element={<RequireRole role="owner"><Asset /></RequireRole>} />
            <Route path="/wrapped/:id" element={<RequireRole role="owner"><Wrapped /></RequireRole>} />
            <Route path="/bank" element={<RequireRole role="bank"><Applications /></RequireRole>} />
            <Route path="/bank/file/:id" element={<RequireRole role="bank"><CreditFile /></RequireRole>} />
            <Route path="/bank/portfolio" element={<RequireRole role="bank"><Portfolio /></RequireRole>} />
            <Route path="/demo" element={<DemoControl />} />
            <Route path="/demo/orchestrate" element={<Orchestrate />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}
