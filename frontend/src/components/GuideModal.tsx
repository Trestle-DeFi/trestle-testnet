import { useState } from "react";

interface QAItem {
  q: string;
  a: string;
}

const FAQ: QAItem[] = [
  {
    q: "How do I get testnet POL for Polygon Amoy?",
    a: "Use one of these faucets:\n• Alchemy: alchemy.com/faucets/polygon-amoy (0.1 POL/day)\n• QuickNode: faucet.quicknode.com/polygon/amoy (0.1 POL/day)\n• Polygon PoS: faucet.polygon.technology (0.001 POL)\nJust paste your wallet address and claim.",
  },
  {
    q: "How do I get testnet ETH for Base Sepolia?",
    a: "Use one of these faucets:\n• Alchemy: alchemy.com/faucets/base-sepolia (0.01 ETH/day)\n• QuickNode: faucet.quicknode.com/base/sepolia (0.01 ETH/day)\n• Coinbase: coinbase.com/faucets/base-ethereum-sepolia-faucet (0.001 ETH/day)",
  },
  {
    q: "How do I get testnet ETH for Arbitrum Sepolia?",
    a: "Use one of these faucets:\n• Alchemy: alchemy.com/faucets/arbitrum-sepolia (0.01 ETH/day)\n• QuickNode: faucet.quicknode.com/arbitrum/sepolia (0.01 ETH/day)",
  },
  {
    q: "How do I mint Trestle test tokens?",
    a: "Go to the Faucet page. Connect your wallet, switch to a supported testnet (Amoy, Base, or Arbitrum), then click Mint on USDC, USDT, xNOBT, or xBRT. Default is 1000 per token. You need 1000 USDC to get auto-whitelisted for RWA.",
  },
  {
    q: "What are the Trestle testnet tasks?",
    a: "1) Create a Profile on-chain\n2) Mint USDC + USDT from the Faucet\n3) List a Digital Good on the Marketplace\n4) Buy a Digital Good via escrow\n5) Create a Freelance Gig with milestones\n6) Fund a Freelance Project\n7) Sync Oracle Price on the RWA page\n8) Mint RWA Token (DA1) via Subscribe\n9) Redeem RWA Token at maturity\n10) Check your Dashboard for balances + tx history",
  },
  {
    q: "What networks does Trestle support?",
    a: "Three testnets:\n• Polygon Amoy (Chain ID: 80002) — native token POL\n• Base Sepolia (Chain ID: 84532) — native token ETH\n• Arbitrum Sepolia (Chain ID: 421614) — native token ETH\nYou can switch networks from the banner at the top.",
  },
  {
    q: "How does the Freelance escrow work?",
    a: "Freelancers create gigs with milestones (description, amount, deadline). Clients fund the full amount — funds are held in escrow. As work is completed, milestones are approved and funds release step by step. Clients can also post projects with a fixed budget.",
  },
  {
    q: "How do I mint RWA tokens?",
    a: "1) Go to the RWA page\n2) First mint 1000 USDC from the Faucet — you'll be auto-whitelisted\n3) Click 'Sync Price' to fetch the latest Chainlink oracle price\n4) Click 'Subscribe' to mint DA1 tokens at the oracle price\n5) Token holders earn yield and can redeem at the redemption date",
  },
  {
    q: "Where can I report bugs or ask questions?",
    a: "Join the Trestle community:\n• Telegram: t.me/TrestleDeFi\n• Or use the Astra AI chat widget (bottom-right corner) to ask about tasks, rewards, or anything else.",
  },
];

export default function GuideModal() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
        title="Help & Guide"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Guide
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Testnet Guide & FAQ</h2>
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {FAQ.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 pr-2">{item.q}</span>
                    <svg
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${expanded === i ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expanded === i && (
                    <div className="px-4 pb-4 text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
