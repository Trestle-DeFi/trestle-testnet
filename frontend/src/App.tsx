import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTelegram } from "./hooks/useTelegram";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import Staking from "./pages/Staking";
import Verify from "./pages/Verify";
import Tasks from "./pages/Tasks";
import Withdraw from "./pages/Withdraw";

export default function App() {
  const { ready, expand } = useTelegram();

  useEffect(() => {
    ready();
    expand();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/stake" element={<Staking />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/withdraw" element={<Withdraw />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
