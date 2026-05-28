import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/hud/ThemeProvider";
import Index from "./pages/Index.tsx";
import AssetDetail from "./pages/AssetDetail.tsx";
import SectorAggregates from "./pages/SectorAggregates.tsx";
import Backtests from "./pages/Backtests.tsx";
import News from "./pages/News.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";
import Overview from "./pages/Overview.tsx";
import TrendFragility from "./pages/TrendFragility.tsx";
import RiskCycle from "./pages/RiskCycle.tsx";
import MarketInternals from "./pages/MarketInternals.tsx";
import {
  BreadthOverview,
  BreadthComponents,
  BreadthThrusts,
  BreadthCapitulation,
} from "./pages/Breadth.tsx";
import MacroPage from "./pages/MacroPage.tsx";
import PositionSizing from "./pages/PositionSizing.tsx";
import MarketOverview from "./pages/tpmr/MarketOverview.tsx";
import DualTrendPage from "./pages/tpmr/DualTrend.tsx";
import TctmGuide from "./pages/tpmr/TctmGuide.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/trend-fragility" element={<TrendFragility />} />
            <Route path="/risk-cycle" element={<RiskCycle />} />
            <Route path="/market-internals" element={<MarketInternals />} />
            <Route path="/breadth/overview" element={<BreadthOverview />} />
            <Route path="/breadth/components" element={<BreadthComponents />} />
            <Route path="/breadth/thrusts" element={<BreadthThrusts />} />
            <Route path="/breadth/capitulation" element={<BreadthCapitulation />} />
            <Route path="/asset/:symbol" element={<AssetDetail />} />
            <Route path="/sectors" element={<SectorAggregates />} />
            <Route path="/backtests" element={<Backtests />} />
            <Route path="/news" element={<News />} />
            <Route path="/macro/mo-indicators" element={<MacroPage slug="mo-indicators" />} />
            <Route path="/macro/us-growth" element={<MacroPage slug="us-growth" />} />
            <Route path="/macro/labor" element={<MacroPage slug="labor" />} />
            <Route path="/macro/global-growth" element={<MacroPage slug="global-growth" />} />
            <Route path="/macro/liquidity" element={<MacroPage slug="liquidity" />} />
            <Route path="/macro/inflation" element={<MacroPage slug="inflation" />} />
            <Route path="/macro/recession" element={<MacroPage slug="recession" />} />
            <Route path="/macro/implied-regime" element={<MacroPage slug="implied-regime" />} />
            <Route path="/tools/position-sizing" element={<PositionSizing />} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
