import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useReadContracts, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { useContracts } from "../hooks/useContracts";
import { validateGigDraft, validateProjectDraft } from "../lib/validation";
import { createLocalMetadataURI } from "../lib/ipfsFallback";
import ErrorBanner from "../components/ErrorBanner";
import TxStatus, { type TxState } from "../components/TxStatus";

type Tab = "browse" | "create-gig" | "create-project" | "disputes";

const DISPUTE_AGENT_ROLE = "0xb59c7152b641f4c1d8a49b7c641a00377c451077a444110de93247b259747f8c" as `0x${string}`;

export default function Freelance() {
  const { address, isConnected, freelancerEscrowReady, freelancerEscrowAddr, freelancerEscrowABI, explorer, chainCurrency } = useContracts();
  const { connector } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { chainId } = useAccount();
  const addr = freelancerEscrowAddr as Address;

  const [tab, setTab] = useState<Tab>("browse");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState<TxState>("confirmed");
  const [error, setError] = useState("");

  // ── Create Gig form ──
  const [gigTitle, setGigTitle] = useState("Web Dev");
  const [gigDesc, setGigDesc] = useState("ipfs://QmDescription");
  const [gigGithub, setGigGithub] = useState("");
  const [gigPortfolio, setGigPortfolio] = useState("");
  const [gigCategory, setGigCategory] = useState("development");
  const [gigMinBudget, setGigMinBudget] = useState("0");
  const [gigPrice, setGigPrice] = useState("0.00001");
  const [gigMsDesc, setGigMsDesc] = useState("Design,Develop,Deploy");
  const [gigMsAmt, setGigMsAmt] = useState("0.000003,0.000004,0.000003");
  const [gigMsDur, setGigMsDur] = useState("7,14,21");

  // ── Create Project form ──
  const [projTitle, setProjTitle] = useState("Build a DApp");
  const [projDesc, setProjDesc] = useState("ipfs://QmProjectSpec");
  const [projGithub, setProjGithub] = useState("");
  const [projCategory, setProjCategory] = useState("development");
  const [projDurationDays, setProjDurationDays] = useState("30");
  const [projBudget, setProjBudget] = useState("0.00003");
  const [projMsDesc, setProjMsDesc] = useState("Frontend,Smart Contract,Testing");
  const [projMsAmt, setProjMsAmt] = useState("0.00001,0.00001,0.00001");
  const [projMsDur, setProjMsDur] = useState("14,21,7");

  // Zero-API IPFS generation helper
  async function generateIpfsForGig() {
    try {
      const res = await createLocalMetadataURI({
        title: gigTitle,
        description: `Gig: ${gigTitle}`,
        category: gigCategory,
      });
      setGigDesc(res.uri);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function generateIpfsForProject() {
    try {
      const res = await createLocalMetadataURI({
        title: projTitle,
        description: `Project: ${projTitle}`,
        category: projCategory,
      });
      setProjDesc(res.uri);
    } catch (e: any) {
      console.error(e);
    }
  }

  function parseMilestones(descs: string, amounts: string, durs: string) {
    const d = descs.split(",").map(s => s.trim());
    const a = amounts.split(",").map(s => s.trim());
    const du = durs.split(",").map(s => s.trim());
    const n = Math.min(d.length, a.length, du.length);
    return {
      descs: d.slice(0, n),
      amounts: a.slice(0, n),
      deadlines: du.slice(0, n).map(s => BigInt(Math.floor(Date.now() / 1000) + parseInt(s) * 86400)),
    };
  }

  // ── F1: client-side validation of the create-gig / create-project forms ──
  const gigFormError = useMemo(
    () => validateGigDraft({ title: gigTitle, descriptionURI: gigDesc, price: gigPrice, milestones: { descriptions: gigMsDesc, amounts: gigMsAmt, durations: gigMsDur } }),
    [gigTitle, gigDesc, gigPrice, gigMsDesc, gigMsAmt, gigMsDur],
  );
  const projectFormError = useMemo(
    () => validateProjectDraft({ title: projTitle, descriptionURI: projDesc, totalBudget: projBudget, milestones: { descriptions: projMsDesc, amounts: projMsAmt, durations: projMsDur } }),
    [projTitle, projDesc, projBudget, projMsDesc, projMsAmt, projMsDur],
  );

  async function handleCreateGig() {
    if (!freelancerEscrowReady || busy) return;
    const invalid = validateGigDraft({ title: gigTitle, descriptionURI: gigDesc, price: gigPrice, milestones: { descriptions: gigMsDesc, amounts: gigMsAmt, durations: gigMsDur } });
    if (invalid) { setError(invalid); return; }
    setBusy(true); setTxHash(""); setError("");
    try {
      const { descs, amounts, deadlines } = parseMilestones(gigMsDesc, gigMsAmt, gigMsDur);
      const hash = await writeContractAsync({
        abi: freelancerEscrowABI, address: addr,
        functionName: "createGig",
        args: [gigTitle, gigDesc, gigGithub, gigPortfolio, gigCategory, parseUnits(gigMinBudget || "0", 18), parseUnits(gigPrice, 18), descs, amounts.map(a => parseUnits(a, 18)), deadlines],
        chainId, connector,
      } as any);
      setTxHash(hash); setTxStatus("pending");
    } catch (e: any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to create gig"); setTxStatus("failed"); }
    finally { setBusy(false); }
  }

  async function handleCreateProject() {
    if (!freelancerEscrowReady || busy) return;
    const invalid = validateProjectDraft({ title: projTitle, descriptionURI: projDesc, totalBudget: projBudget, milestones: { descriptions: projMsDesc, amounts: projMsAmt, durations: projMsDur } });
    if (invalid) { setError(invalid); return; }
    setBusy(true); setTxHash(""); setError("");
    try {
      const { descs, amounts, deadlines } = parseMilestones(projMsDesc, projMsAmt, projMsDur);
      const hash = await writeContractAsync({
        abi: freelancerEscrowABI, address: addr,
        functionName: "createProjectFixed",
        args: [projTitle, projDesc, projGithub, projCategory, BigInt(projDurationDays || 0), parseUnits(projBudget, 18), descs, amounts.map(a => parseUnits(a, 18)), deadlines],
        chainId, connector,
      } as any);
      setTxHash(hash); setTxStatus("pending");
    } catch (e: any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to create project"); setTxStatus("failed"); }
    finally { setBusy(false); }
  }

  // ── Read gigs & projects ──
  const ABI = freelancerEscrowABI;
  const { data: gigCountData } = useReadContracts({
    contracts: [{ abi: ABI, address: addr, functionName: "gigCount", args: [] }],
    query: { enabled: freelancerEscrowReady },
  } as any);
  const gigCount = Number(gigCountData?.[0]?.result || 0n);

  const { data: projCountData } = useReadContracts({
    contracts: [{ abi: ABI, address: addr, functionName: "projectCount", args: [] }],
    query: { enabled: freelancerEscrowReady },
  } as any);
  const projCount = Number(projCountData?.[0]?.result || 0n);

  const gigIds = useMemo(() => Array.from({ length: gigCount }, (_, i) => i + 1), [gigCount]);
  const projIds = useMemo(() => Array.from({ length: projCount }, (_, i) => i + 1), [projCount]);

  const gigCalls = useMemo(() => gigIds.map(id => ({ abi: ABI, address: addr, functionName: "gigs", args: [BigInt(id)] })), [gigIds, addr]);
  const projCalls = useMemo(() => projIds.map(id => ({ abi: ABI, address: addr, functionName: "projects", args: [BigInt(id)] })), [projIds, addr]);

  const { data: gigsRaw } = useReadContracts({ contracts: gigCalls as any, query: { enabled: gigCount > 0 } } as any);
  const { data: projsRaw, refetch: refetchProjects } = useReadContracts({ contracts: projCalls as any, query: { enabled: projCount > 0 } } as any);

  // Check if connected address is a Dispute Agent or Default Admin
  const { data: isDisputeAgent } = useReadContract({
    abi: ABI,
    address: addr,
    functionName: "hasRole",
    args: [DISPUTE_AGENT_ROLE, address as `0x${string}`],
    query: { enabled: !!address && freelancerEscrowReady },
  });

  const gigs = useMemo(() => {
    if (!gigsRaw) return [];
    return gigIds.map((id, i) => {
      const r = gigsRaw[i]?.result as any;
      if (!r) return null;
      return { id: BigInt(id), freelancer: r[1] as Address, title: r[2] as string, desc: r[3] as string, github: r[4] as string, portfolio: r[5] as string, category: r[6] as string, minBudget: r[7] as bigint, price: r[8] as bigint, active: r[9] as boolean };
    }).filter((g): g is NonNullable<typeof g> => g != null);
  }, [gigsRaw, gigIds]);

  const projects = useMemo(() => {
    if (!projsRaw) return [];
    return projIds.map((id, i) => {
      const r = projsRaw[i]?.result as any;
      if (!r) return null;
      return { id: BigInt(id), client: r.client as Address, freelancer: r.freelancer as Address, status: Number(r.status), totalBudget: r.totalBudget as bigint, escrowed: r.escrowedAmount as bigint, title: r.title as string, desc: r.descriptionURI as string, github: r.github as string, category: r.category as string, durationDays: r.durationDays as bigint };
    }).filter((p): p is NonNullable<typeof p> => p != null);
  }, [projsRaw, projIds]);

  const disputedProjects = useMemo(() => projects.filter(p => p.status === 4), [projects]);

  async function handleHire(gigId: bigint, price: bigint) {
    if (!freelancerEscrowReady || busy) return;
    setBusy(true); setTxHash(""); setError("");
    try {
      const hash = await writeContractAsync({
        abi: ABI, address: addr, functionName: "hireGig",
        args: [gigId], value: price, chainId, connector,
      } as any);
      setTxHash(hash); setTxStatus("pending");
    } catch (e: any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to hire"); setTxStatus("failed"); }
    finally { setBusy(false); }
  }

  async function handleDispute(projectId: bigint) {
    if (!freelancerEscrowReady || busy) return;
    setBusy(true); setTxHash(""); setError("");
    try {
      const hash = await writeContractAsync({
        abi: ABI, address: addr, functionName: "disputeProject",
        args: [projectId], chainId, connector,
      } as any);
      setTxHash(hash); setTxStatus("pending");
      refetchProjects?.();
    } catch (e: any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to raise dispute"); setTxStatus("failed"); }
    finally { setBusy(false); }
  }

  async function handleResolve(projectId: bigint, toFreelancer: boolean) {
    if (!freelancerEscrowReady || busy) return;
    setBusy(true); setTxHash(""); setError("");
    try {
      const hash = await writeContractAsync({
        abi: ABI, address: addr, functionName: "resolveDispute",
        args: [projectId, toFreelancer], chainId, connector,
      } as any);
      setTxHash(hash); setTxStatus("pending");
      refetchProjects?.();
    } catch (e: any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to resolve dispute"); setTxStatus("failed"); }
    finally { setBusy(false); }
  }

  async function handleAutoResolve(projectId: bigint) {
    if (!freelancerEscrowReady || busy) return;
    setBusy(true); setTxHash(""); setError("");
    try {
      const hash = await writeContractAsync({
        abi: ABI, address: addr, functionName: "autoResolveDispute",
        args: [projectId], chainId, connector,
      } as any);
      setTxHash(hash); setTxStatus("pending");
      refetchProjects?.();
    } catch (e: any) { console.error(e); setError(e?.shortMessage || e?.message || "Failed to auto-resolve dispute"); setTxStatus("failed"); }
    finally { setBusy(false); }
  }

  const isOwner = (a: Address) => address && a.toLowerCase() === address.toLowerCase();
  const isParticipant = (p: { client: Address; freelancer: Address }) =>
    address && (p.client.toLowerCase() === address.toLowerCase() || p.freelancer.toLowerCase() === address.toLowerCase());

  const STATUS = ["Open", "In Progress", "Completed", "Cancelled", "Disputed"];

  return (
    <div className="space-y-6">
      {/* walkthrough */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
        <strong>How Freelance Works:</strong> Freelancers{" "}
        <strong>create gigs</strong> (list a service with milestone breakdown).{" "}
        Clients <strong>hire</strong> by funding the full amount — funds are released{" "}
        milestone-by-milestone as work is approved. Clients can also{" "}
        <strong>post projects</strong> with a fixed budget. In case of disagreement, any party can dispute, and authorized dispute agents can arbitrate.
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["browse", "create-gig", "create-project", "disputes"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition ${
                tab === t ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}>
              {t === "browse" ? "Browse" : t === "create-gig" ? "Create Gig" : t === "create-project" ? "Post Project" : `Disputes (${disputedProjects.length})`}
            </button>
          ))}
        </div>
        {Boolean(isDisputeAgent) && (
          <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-1 rounded-full border border-purple-200">
            🛡️ Dispute Agent
          </span>
        )}
      </div>

      {txHash && (
        <TxStatus hash={txHash} status={txStatus} explorer={explorer} />
      )}

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {tab === "browse" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Active Gigs */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Active Gigs ({gigs.filter(g => g.active).length})</h3>
            {gigs.filter(g => g.active).length === 0 ? (
              <p className="text-xs text-gray-400 italic">No gigs listed yet.</p>
            ) : (
              <div className="space-y-3">
                {gigs.filter(g => g.active).map((g: any) => (
                  <div key={g.id.toString()} className="border border-gray-100 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900">{g.title}</span>
                      <span className="text-emerald-600 font-semibold">{formatUnits(g.price, 18)} {chainCurrency}</span>
                    </div>
                    {g.category && <p className="text-xs text-gray-500 mb-1">Category: {g.category}</p>}
                    {g.github && <p className="text-xs text-gray-400 mb-1 break-all">GitHub: {g.github}</p>}
                    {g.portfolio && <p className="text-xs text-gray-400 mb-1 break-all">Portfolio: {g.portfolio}</p>}
                    <p className="text-xs text-gray-400 mb-2">By {g.freelancer.slice(0, 6)}...{g.freelancer.slice(-4)}</p>
                    <button onClick={() => handleHire(g.id, g.price)} disabled={busy || isOwner(g.freelancer)}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs font-medium rounded-lg transition">
                      {busy ? "Processing..." : isOwner(g.freelancer) ? "Your Gig" : "Hire"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Projects & Workflows */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Projects ({projects.length})</h3>
            {projects.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No projects yet.</p>
            ) : (
              <div className="space-y-3">
                {projects.map((p: any) => (
                  <div key={p.id.toString()} className="border border-gray-100 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900">{p.title}</span>
                      <span className="text-blue-600 font-semibold">{formatUnits(p.totalBudget, 18)} {chainCurrency}</span>
                    </div>
                    {p.category && <p className="text-xs text-gray-500 mb-1">Category: {p.category}</p>}
                    {p.github && <p className="text-xs text-gray-400 mb-1 break-all">GitHub: {p.github}</p>}
                    <p className="text-xs text-gray-400 mb-1">Client: {p.client.slice(0, 6)}...{p.client.slice(-4)}</p>
                    {p.freelancer !== "0x0000000000000000000000000000000000000000" && (
                      <p className="text-xs text-gray-400 mb-1">Freelancer: {p.freelancer.slice(0, 6)}...{p.freelancer.slice(-4)}</p>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        p.status === 0 ? "bg-blue-100 text-blue-700" :
                        p.status === 1 ? "bg-amber-100 text-amber-700" :
                        p.status === 2 ? "bg-green-100 text-green-700" :
                        p.status === 3 ? "bg-gray-100 text-gray-700" :
                        "bg-red-100 text-red-700 font-semibold"
                      }`}>
                        {STATUS[p.status] || "Unknown"}
                      </span>
                      {p.status === 1 && isParticipant(p) && (
                        <button onClick={() => handleDispute(p.id)} disabled={busy}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition">
                          Raise Dispute
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "disputes" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">Dispute Resolution Portal</h3>
              <p className="text-xs text-gray-500">Arbitrate contested escrows with 100% on-chain transparency.</p>
            </div>
            {Boolean(isDisputeAgent) ? (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                Authorized Arbiter
              </span>
            ) : (
              <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">
                Observer Mode
              </span>
            )}
          </div>

          {disputedProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No active disputes on this network. All escrows in good standing.
            </div>
          ) : (
            <div className="space-y-4">
              {disputedProjects.map(p => (
                <div key={p.id.toString()} className="border border-red-200 bg-red-50/30 rounded-xl p-4 text-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900">Project #{p.id.toString()}: {p.title}</h4>
                      <p className="text-xs text-gray-500">Escrow: {formatUnits(p.escrowed, 18)} {chainCurrency}</p>
                    </div>
                    <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                      Disputed
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-100">
                    <div>
                      <span className="font-medium text-gray-500">Client:</span><br />
                      <span className="font-mono">{p.client.slice(0, 10)}...{p.client.slice(-6)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Freelancer:</span><br />
                      <span className="font-mono">{p.freelancer.slice(0, 10)}...{p.freelancer.slice(-6)}</span>
                    </div>
                  </div>

                  {Boolean(isDisputeAgent) ? (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => handleResolve(p.id, true)} disabled={busy}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition disabled:bg-gray-300">
                        {busy ? "Resolving..." : "Rule for Freelancer"}
                      </button>
                      <button onClick={() => handleResolve(p.id, false)} disabled={busy}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition disabled:bg-gray-300">
                        {busy ? "Resolving..." : "Rule for Client (Refund)"}
                      </button>
                    </div>
                  ) : isParticipant(p) ? (
                    <div className="pt-2">
                      <button onClick={() => handleAutoResolve(p.id)} disabled={busy}
                        className="w-full py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-lg transition disabled:bg-gray-300">
                        Auto-Resolve After Timeout
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center">
                      Only authorized dispute agents or escrow participants can interact with this dispute.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "create-gig" && (
        <div className="max-w-lg bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Create a Gig (Freelancer)</h3>
          <p className="text-xs text-gray-500">List your service with milestone-based payments.</p>
          {[{ label: "Title", val: gigTitle, set: setGigTitle },
            { label: "Description URI (ipfs://...)", val: gigDesc, set: setGigDesc, hasGenerate: true, onGen: generateIpfsForGig },
            { label: "GitHub (optional)", val: gigGithub, set: setGigGithub },
            { label: "Portfolio URI (optional)", val: gigPortfolio, set: setGigPortfolio },
            { label: "Category (optional)", val: gigCategory, set: setGigCategory },
            { label: `Min Budget (${chainCurrency}, optional)`, val: gigMinBudget, set: setGigMinBudget, type: "number" },
            { label: `Price (${chainCurrency})`, val: gigPrice, set: setGigPrice, type: "number" },
            { label: "Milestone Descriptions (comma-sep)", val: gigMsDesc, set: setGigMsDesc },
            { label: "Milestone Amounts (comma-sep)", val: gigMsAmt, set: setGigMsAmt },
            { label: "Milestone Deadlines (days, comma-sep)", val: gigMsDur, set: setGigMsDur },
          ].map(f => (
            <div key={f.label}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-500">{f.label}</label>
                {f.hasGenerate && (
                  <button type="button" onClick={f.onGen} className="text-[11px] text-emerald-600 hover:underline">
                    Generate Hash URI
                  </button>
                )}
              </div>
              <input value={f.val} onChange={e => f.set(e.target.value)} type={f.type || "text"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <button onClick={handleCreateGig} disabled={busy || !freelancerEscrowReady || !!gigFormError}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition">
            {busy ? "Creating..." : "Create Gig"}
          </button>
          {gigFormError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{gigFormError}</p>}
        </div>
      )}

      {tab === "create-project" && (
        <div className="max-w-lg bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Post a Project (Client)</h3>
          <p className="text-xs text-gray-500">Post a fixed-budget project with milestones for freelancers to apply.</p>
          {[{ label: "Title", val: projTitle, set: setProjTitle },
            { label: "Description URI (ipfs://...)", val: projDesc, set: setProjDesc, hasGenerate: true, onGen: generateIpfsForProject },
            { label: "GitHub / Repo (optional)", val: projGithub, set: setProjGithub },
            { label: "Category (optional)", val: projCategory, set: setProjCategory },
            { label: "Duration (days, optional)", val: projDurationDays, set: setProjDurationDays, type: "number" },
            { label: `Total Budget (${chainCurrency})`, val: projBudget, set: setProjBudget, type: "number" },
            { label: "Milestone Descriptions (comma-sep)", val: projMsDesc, set: setProjMsDesc },
            { label: "Milestone Amounts (comma-sep)", val: projMsAmt, set: setProjMsAmt },
            { label: "Milestone Deadlines (days, comma-sep)", val: projMsDur, set: setProjMsDur },
          ].map(f => (
            <div key={f.label}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-500">{f.label}</label>
                {f.hasGenerate && (
                  <button type="button" onClick={f.onGen} className="text-[11px] text-emerald-600 hover:underline">
                    Generate Hash URI
                  </button>
                )}
              </div>
              <input value={f.val} onChange={e => f.set(e.target.value)} type={f.type || "text"}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
          <button onClick={handleCreateProject} disabled={busy || !freelancerEscrowReady || !!projectFormError}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition">
            {busy ? "Creating..." : "Create Project"}
          </button>
          {projectFormError && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{projectFormError}</p>}
        </div>
      )}
    </div>
  );
}
