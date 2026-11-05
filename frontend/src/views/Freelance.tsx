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
  const [gigStartDate, setGigStartDate] = useState(new Date());
  const [gigEndDate, setGigEndDate] = useState("");


  // ── Create Project form ──
  const [projTitle, setProjTitle] = useState("Build a DApp");
  const [projDesc, setProjDesc] = useState("ipfs://QmProjectSpec");
  const [projGithub, setProjGithub] = useState("");
  const [projCategory, setProjCategory] = useState("development");
  const [projStartDate, setProjStartDate] = useState(new Date());
  const [projDurationDays, setProjDurationDays] = useState("30");
  const [projBudget, setProjBudget] = useState("0.00003");
  const [projMsDesc, setProjMsDesc] = useState("Frontend,Smart Contract,Testing");
  const [projMsAmt, setProjMsAmt] = useState("0.00001,0.00001,0.00001");
  const [projMsDur, setProjMsDur] = useState("14,21,7");
  const [projEndDate, setProjEndDate] = useState(new Date());

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

  function daysBetween(start: Date, end: Date): number {
    if (!start || !end) return 0;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(0, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
  }

  function parseMilestones(descs: string, amounts: string, durs: string, startDate: Date) {
    const d = descs.split(",").map(s => s.trim());
    const a = amounts.split(",").map(s => s.trim());
    const du = durs.split(",").map(s => s.trim());
    const n = Math.min(d.length, a.length, du.length);
    const startMs = startDate.getTime();
    return {
      descs: d.slice(0, n),
      amounts: a.slice(0, n),
      deadlines: du.slice(0, n).map(s => BigInt(Math.floor(startMs / 1000) + parseInt(s) * 86400)),
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
      const { descs, amounts, deadlines } = parseMilestones(gigMsDesc, gigMsAmt, gigMsDur, gigStartDate);
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
const { descs, amounts, deadlines } = parseMilestones(projMsDesc, projMsAmt, projMsDur, projStartDate);
      const computedDuration = projStartDate && projEndDate ? daysBetween(projStartDate, projEndDate) : Number(projDurationDays || 0);
      if (computedDuration > 0) setProjDurationDays(String(computedDuration));
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
      return {
        id: Number(r[0]),
        title: r[1],
        descriptionURI: r[2],
        freelancerAddress: r[3],
        clientAddress: r[4],
        createdAt: Number(r[5]) * 1000,
        durationDays: Number(r[6]),
        price: r[7],
        status: Number(r[8]),
      };
    });
  }, [gigsRaw]);

  const projects = useMemo(() => {
    if (!projsRaw) return [];
    return projsRaw.map((id, i) => {
      const r = projsRaw[i]?.result as any;
      if (!r) return null;
      return {
        id: Number(r[0]),
        title: r[1],
        descriptionURI: r[2],
        freelancerAddress: r[3],
        clientAddress: r[4],
        deadline: Number(r[5]) * 1000,
        status: Number(r[6]),
      };
    });
  }, [projsRaw]);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-800 p-4">
        <h1 className="text-white text-xl font-bold">Trestle Freelancer</h1>
      </nav>
      <div className="max-w-6xl mx-auto p-4">
        <ErrorBanner message={error} />
        <div className="flex gap-4 mb-6">
          <button onClick={() => setTab('browse')} className="px-4 py-2 rounded-lg {tab === 'browse' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}">
            Browse
          </button>
          <button onClick={() => setTab('create-gig')} className="px-4 py-2 rounded-lg {tab === 'create-gig' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'}">
            Create Gig
          </button>
          <button onClick={() => setTab('create-project')} className="px-4 py-2 rounded-lg {tab === 'create-project' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'}">
            Create Project
          </button>
          <button onClick={() => setTab('disputes')} className="px-4 py-2 rounded-lg {tab === 'disputes' ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700'}">
            Disputes
          </button>
        </div>

        {tab === 'browse' && (
          <>
            <h2 className="text-2xl font-bold mb-4">Available Gigs</h2>
            {gigs.length === 0 ? <p className="text-slate-500">No gigs available.</p> : (
              <div className="grid gap-4">
                {gigs.filter(Boolean).map((g) => (
                  <div key={g!.id} className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-bold">{g!.title}</h3>
                    <p className="text-slate-600 text-sm">{g!.price} ETH · {g!.durationDays} days</p>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Client: {g!.clientAddress?.slice(0, 6)}...{g!.clientAddress?.slice(-4)}</span> | <span>Status: {g!.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-2xl font-bold mb-4 mt-8">Active Projects</h2>
            {projects.length === 0 ? <p className="text-slate-500">No active projects.</p> : (
              <div className="grid gap-4">
                {projects.filter(Boolean).map((p) => (
                  <div key={p!.id} className="border rounded-lg p-4 bg-white">
                    <h3 className="text-lg font-bold">{p!.title}</h3>
                    <p className="text-slate-600 text-sm">Deadline: {new Date(p!.deadline).toLocaleDateString()}</p>
                    <div className="mt-4 text-xs text-slate-500">
                      <span>Freelancer: {p!.freelancerAddress?.slice(0, 6)}...{p!.freelancerAddress?.slice(-4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'create-gig' && (
          <div className="bg-white p-6 rounded-lg shadow border">
            <h2 className="text-2xl font-bold mb-6">Create Gig</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateGig(); }}>
              <div className="grid gap-4">
                <input placeholder="Title" className="p-2 border rounded" value={gigTitle} onChange={(e) => setGigTitle(e.target.value)} />
                <input placeholder="Description URI" className="p-2 border rounded" value={gigDesc} onChange={(e) => setGigDesc(e.target.value)} />
                <input placeholder="Milestone Descriptions (comma-separated)" className="p-2 border rounded" value={gigMsDesc} onChange={(e) => setGigMsDesc(e.target.value)} />
                <input placeholder="Milestone Amounts in ETH (comma-separated)" className="p-2 border rounded" value={gigMsAmt} onChange={(e) => setGigMsAmt(e.target.value)} />
                <input placeholder="Milestone Durations in days (comma-separated, e.g. 7,14,21)" className="p-2 border rounded" value={gigMsDur} onChange={(e) => setGigMsDur(e.target.value)} />
                <input type="date" className="p-2 border rounded" value={gigStartDate.toISOString().split('T')[0]} onChange={(e) => setGigStartDate(new Date(e.target.value))} />
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  disabled={
                    busy ||
                    !!gigFormError ||
                    !!validateGigDraft({
                      title: gigTitle,
                      descriptionURI: gigDesc,
                      price: gigPrice,
                      milestones: {
                        descriptions: gigMsDesc,
                        amounts: gigMsAmt,
                        durations: gigMsDur,
                      },
                    })
                  }
                >
                  {busy ? 'Creating...' : 'Create Gig'}
                </button>
              </div>
              {gigFormError && <p className="text-red-500 text-sm mt-2">{gigFormError}</p>}
            </form>
            <div className="mt-4 text-xs text-slate-500">
              <p>Gig statuses: 0=Open, 1=In Progress, 2=Completed, 3=Disputed, 4=Cancelled</p>
            </div>
          </div>
        )}

        {tab === 'create-project' && (
          <div className="bg-white p-6 rounded-lg shadow border">
            <h2 className="text-2xl font-bold mb-6">Create Project</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateProject(); }}>
              <div className="grid gap-4">
                <input placeholder="Project Title" className="p-2 border rounded" value={projTitle} onChange={(e) => setProjTitle(e.target.value)} />
                <input placeholder="Description URI" className="p-2 border rounded" value={projDesc} onChange={(e) => setProjDesc(e.target.value)} />
                <input placeholder="Milestone Descriptions (comma-separated)" className="p-2 border rounded" value={projMsDesc} onChange={(e) => setProjMsDesc(e.target.value)} />
                <input placeholder="Milestone Amounts in ETH (comma-separated)" className="p-2 border rounded" value={projMsAmt} onChange={(e) => setProjMsAmt(e.target.value)} />
                <input placeholder="Milestone Durations in days (comma-separated, e.g. 14,21,7)" className="p-2 border rounded" value={projMsDur} onChange={(e) => setProjMsDur(e.target.value)} />
                <input type="date" className="p-2 border rounded" value={projStartDate.toISOString().split('T')[0]} onChange={(e) => setProjStartDate(new Date(e.target.value))} />
                <input placeholder="Project Budget (ETH)" className="p-2 border rounded" value={projBudget} onChange={(e) => setProjBudget(e.target.value)} />
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
                  disabled={
                    busy ||
                    !!projectFormError ||
                    !!validateProjectDraft({
                      title: projTitle,
                      descriptionURI: projDesc,
                      totalBudget: projBudget,
                      milestones: {
                        descriptions: projMsDesc,
                        amounts: projMsAmt,
                        durations: projMsDur,
                      },
                    })
                  }
                >
                  {busy ? 'Creating...' : 'Create Project'}
                </button>
              </div>
              {projectFormError && <p className="text-red-500 text-sm mt-2">{projectFormError}</p>}
            </form>
            <div className="mt-4 text-xs text-slate-500">
              <p>Project statuses: 0=Created, 1=In Progress, 2=Completed, 3=Disputed, 4=Cancelled</p>
            </div>
          </div>
        )}

        {tab === 'disputes' && (
          <div className="bg-white p-6 rounded-lg shadow border">
            <h2 className="text-2xl font-bold mb-6">Disputes</h2>
            <p className="text-slate-500">Dispute resolution interface coming soon.</p>
          </div>
        )}
      </div>
    </div>
  );
}
