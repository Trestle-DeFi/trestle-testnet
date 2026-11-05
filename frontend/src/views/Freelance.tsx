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
  const [projStartDate, setProjStartDate] = useState("");
  const [projEndDate, setProjEndDate] = useState("");

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

  function daysBetween(start: string, end: string): number {
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
>>>>>>