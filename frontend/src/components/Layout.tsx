import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useContracts } from "../hooks/useContracts";
import { LINKS } from "../config/contracts";
import WalletStatus from "./WalletStatus";
import AstraChat from "./AstraChat";

const EXTERNAL_LINKS = [
  { href: LINKS.mainSite, label: "Landing Page" },
  { href: LINKS.testnet, label: "Testnet Hub" },
];

const DASHBOARD_TABS = [
  { to: "/", label: "Dashboard", icon: "🏠" },
  { to: "/stake", label: "Stake", icon: "📈" },
  { to: "/tasks", label: "Tasks", icon: "📋" },
  { to: "/verify", label: "Verify", icon: "✅" },
  { to: "/withdraw", label: "Wallet", icon: "💰" },
];

export default function Layout() {
  const { isCorrectChain, chainName } = useContracts();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 font-bold text-xl">◆</span>
            <h1 className="text-xl font-bold text-emerald-600">Trestle</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="text-xs text-gray-500 hover:text-emerald-600 transition px-2 py-1 rounded border border-gray-200 hover:border-emerald-300 flex items-center gap-1"
              >
                Links
                <svg className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                  {EXTERNAL_LINKS.map(link => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setDropdownOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <WalletStatus />
            <a
              href={LINKS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-emerald-600 transition"
              title="Telegram"
            >
              ✈
            </a>
          </div>
        </div>
        {!isCorrectChain && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 text-sm rounded text-center">
            Switch to Polygon Amoy or Polygon Mainnet
          </div>
        )}
        {isCorrectChain && (
          <div className="mt-1 text-xs text-gray-400 text-center">{chainName}</div>
        )}
      </header>

      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 overflow-x-auto">
        <div className="max-w-lg mx-auto flex gap-1 px-2 py-1.5">
          {DASHBOARD_TABS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="whitespace-nowrap px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors [&.active]:text-emerald-700 [&.active]:bg-emerald-100 [&.active]:font-semibold flex items-center gap-1"
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-4 pb-8">
        <Outlet />
      </main>
      <AstraChat />
    </div>
  );
}
