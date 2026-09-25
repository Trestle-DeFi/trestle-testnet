"use client";

import dynamic from "next/dynamic";

const FreelanceView = dynamic(() => import("@/views/Freelance"), { ssr: false });

export default function FreelanceRoute() {
  return (
    <div className="pt-6">
      <div className="max-w-4xl mx-auto px-4 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 text-center">Freelance & Escrow Hub</h2>
        <p className="text-xs text-gray-500 text-center mt-1">Milestone-based gigs, project escrows, and decentralized dispute arbitration.</p>
      </div>
      <FreelanceView />
    </div>
  );
}

