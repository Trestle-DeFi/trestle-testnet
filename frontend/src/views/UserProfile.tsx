"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useReadContracts } from "wagmi";
import { getPublicClient } from "wagmi/actions";
import { type Address } from "viem";
import { config } from "@/config/web3";
import { useContracts } from "@/hooks/useContracts";
import ErrorBanner from "@/components/ErrorBanner";
import TxStatus, { type TxState } from "@/components/TxStatus";

type ProfileStruct = { name: string; avatarURI: string; bio: string; location: string; skills: string; exists: boolean };
type SocialStruct = { platform: string; url: string };
type ReviewStruct = { reviewer: Address; rating: number; comment: string; timestamp: bigint; disputed: boolean; resolved: boolean; upheld: boolean };

export default function UserProfilePage() {
  const { address } = useAccount();
  const {
    userProfileReady, userProfileAddr, userProfileABI,
    setProfile, submitReview, addSocial, removeSocial,
  } = useContracts();

  // My profile form
  const [name, setName] = useState("");
  const [avatarURI, setAvatarURI] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");

  // Social form
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialUrl, setSocialUrl] = useState("");

  // Lookup
  const [lookupAddr, setLookupAddr] = useState("");
  const [lookupTarget, setLookupTarget] = useState<Address | null>(null);

  // Review
  const [reviewAddr, setReviewAddr] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const [txHash, setTxHash] = useState("");
  const [txStatus, setTxStatus] = useState<TxState>("confirmed");
  const [error, setError] = useState("");

  const read = (fn: string, args: unknown[]) => ({
    abi: userProfileABI, address: userProfileAddr, functionName: fn, args,
  } as any);

  // Read my profile + socials + scores + progress
  const { data: myData } = useReadContracts({
    contracts: address && userProfileReady ? [
      read("getProfile", [address]),
      read("getSocials", [address]),
      read("hasInteracted", [address]),
      read("getProgress", [address]),
      read("compositeScore", [address]),
      read("getReviewBreakdown", [address]),
      read("passportScore", [address]),
      read("biometricVerified", [address]),
      read("thirdPartyScore", [address]),
      read("reviewScore", [address]),
    ] : [],
    query: { enabled: !!address && userProfileReady },
  });

  // Read looked-up profile
  const { data: lookupData } = useReadContracts({
    contracts: lookupTarget && userProfileReady ? [
      read("getProfile", [lookupTarget]),
      read("getReviewCount", [lookupTarget]),
      read("getReviews", [lookupTarget, BigInt(0), BigInt(10)]),
      read("getSocials", [lookupTarget]),
      read("getProgress", [lookupTarget]),
      read("compositeScore", [lookupTarget]),
      read("getReviewBreakdown", [lookupTarget]),
      read("hasCompletedDeal", [address ?? "0x0000000000000000000000000000000000000000", lookupTarget]),
      read("hasInteracted", [address ?? "0x0000000000000000000000000000000000000000"]),
    ] : [],
    query: { enabled: !!lookupTarget && userProfileReady },
  });

  const myProfile = myData?.[0]?.result as ProfileStruct | undefined;
  const mySocials = (myData?.[1]?.result as SocialStruct[] | undefined) ?? [];
  const myInteracted = myData?.[2]?.result as boolean | undefined;
  const myProgress = myData?.[3]?.result as number | undefined;
  const myComposite = myData?.[4]?.result as number | undefined;
  const myBreakdown = myData?.[5]?.result as { pos: number; neg: number } | undefined;
  const myPassport = myData?.[6]?.result as number | undefined;
  const myBio = myData?.[7]?.result as boolean | undefined;
  const myThird = myData?.[8]?.result as number | undefined;
  const myReview = myData?.[9]?.result as number | undefined;

  const lookupProfile = lookupData?.[0]?.result as ProfileStruct | undefined;
  const lookupReviewCount = lookupData?.[1]?.result as bigint | undefined;
  const lookupReviews = (lookupData?.[2]?.result as ReviewStruct[] | undefined) ?? [];
  const lookupSocials = (lookupData?.[3]?.result as SocialStruct[] | undefined) ?? [];
  const lookupProgress = lookupData?.[4]?.result as number | undefined;
  const lookupComposite = lookupData?.[5]?.result as number | undefined;
  const lookupBreakdown = lookupData?.[6]?.result as { pos: number; neg: number } | undefined;
  const canReview = lookupData?.[7]?.result as boolean | undefined;
  const iInteracted = lookupData?.[8]?.result as boolean | undefined;

  const runTx = async (fn: () => Promise<`0x${string}`>) => {
    setError("");
    try {
      const hash = await fn();
      setTxHash(hash); setTxStatus("pending");
      const receipt = await getPublicClient(config)!.waitForTransactionReceipt({ hash });
      setTxStatus(receipt.status === "success" ? "confirmed" : "failed");
      return true;
    } catch (e: any) {
      console.error(e);
      setError(e?.shortMessage || e?.message || "Transaction failed.");
      setTxStatus("failed");
      return false;
    }
  };

  const handleSetProfile = async () => {
    await runTx(() => setProfile(name.trim(), avatarURI.trim(), bio.trim(), location.trim(), skills.trim()));
  };

  const handleAddSocial = async () => {
    if (!socialPlatform.trim() || !socialUrl.trim()) return;
    const ok = await runTx(() => addSocial(socialPlatform.trim(), socialUrl.trim()));
    if (ok) { setSocialPlatform(""); setSocialUrl(""); }
  };

  const handleRemoveSocial = async (index: number) => {
    await runTx(() => removeSocial(index));
  };

  const handleLookup = () => {
    if (!lookupAddr.trim()) return;
    setLookupTarget(lookupAddr.trim() as Address);
  };

  const handleReview = async () => {
    if (!reviewAddr.trim()) return;
    const ok = await runTx(() => submitReview(reviewAddr.trim() as Address, rating, comment.trim()));
    if (ok) { setReviewAddr(""); setRating(5); setComment(""); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">User Profile</h2>

      {/* Progress */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-700">Profile Completeness</h3>
          <span className="text-sm font-medium text-emerald-600">{Number(myProgress ?? 0)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${Number(myProgress ?? 0)}%` }} />
        </div>
        {!myInteracted && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Create a project, gig, or listing on the platform to unlock your profile.
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500">Composite</p>
            <p className="text-gray-900 font-semibold">{Number(myComposite ?? 0)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500">Passport</p>
            <p className="text-gray-900 font-semibold">{Number(myPassport ?? 0)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500">Biometric</p>
            <p className="text-gray-900 font-semibold">{myBio ? "Verified" : "—"}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500">3rd Party</p>
            <p className="text-gray-900 font-semibold">{Number(myThird ?? 0)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-gray-500">Reviews</p>
            <p className="text-gray-900 font-semibold">{Number(myReview ?? 0)}</p>
          </div>
        </div>
        {myBreakdown && (
          <p className="text-xs text-gray-500">
            Reviews: <span className="text-emerald-600 font-medium">{Number(myBreakdown.pos)} positive</span>
            {" · "}
            <span className="text-red-500 font-medium">{Number(myBreakdown.neg)} negative</span>
          </p>
        )}
      </section>

      {/* My Profile */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">My Profile</h3>
        {myProfile?.exists ? (
          <div className="space-y-1 text-sm text-gray-600">
            <p><span className="font-medium text-gray-800">Name:</span> {myProfile.name}</p>
            {myProfile.avatarURI && <p><span className="font-medium text-gray-800">Avatar:</span> <span className="break-all">{myProfile.avatarURI}</span></p>}
            {myProfile.bio && <p><span className="font-medium text-gray-800">Bio:</span> {myProfile.bio}</p>}
            {myProfile.location && <p><span className="font-medium text-gray-800">Location:</span> {myProfile.location}</p>}
            {myProfile.skills && <p><span className="font-medium text-gray-800">Skills:</span> {myProfile.skills}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No profile set yet.</p>
        )}

        <div className="border-t pt-4 space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (required)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={avatarURI} onChange={e => setAvatarURI(e.target.value)} placeholder="Avatar URI (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio (optional, max 280)" rows={3} maxLength={280} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Skills, comma separated (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <button onClick={handleSetProfile} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
            Save Profile
          </button>
        </div>
      </section>

      {/* Socials */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Social Links</h3>
        {mySocials.length > 0 ? (
          <ul className="space-y-2">
            {mySocials.map((s, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-700 font-medium">{s.platform}</span>
                <span className="text-gray-500 break-all mx-2 flex-1 truncate">{s.url}</span>
                <button onClick={() => handleRemoveSocial(i)} className="text-red-500 hover:text-red-700 text-xs font-medium ml-2">Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 italic">No social links yet.</p>
        )}
        <div className="flex gap-2 border-t pt-4">
          <input value={socialPlatform} onChange={e => setSocialPlatform(e.target.value)} placeholder="Platform (twitter, github…)" className="w-1/3 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input value={socialUrl} onChange={e => setSocialUrl(e.target.value)} placeholder="URL" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <button onClick={handleAddSocial} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Add</button>
        </div>
      </section>

      {/* Lookup */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Look Up User</h3>
        <div className="flex gap-2">
          <input value={lookupAddr} onChange={e => setLookupAddr(e.target.value)} placeholder="0x..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
          <button onClick={handleLookup} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">Search</button>
        </div>
        {lookupProfile && (
          <div className="text-sm text-gray-600 space-y-2 pt-2 border-t">
            <div className="flex items-center gap-3">
              <p><span className="font-medium text-gray-800">Name:</span> {lookupProfile.name || <span className="italic text-gray-400">not set</span>}</p>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">Composite {Number(lookupComposite ?? 0)}</span>
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">{Number(lookupProgress ?? 0)}%</span>
            </div>
            {lookupProfile.avatarURI && <p><span className="font-medium text-gray-800">Avatar:</span> <span className="break-all">{lookupProfile.avatarURI}</span></p>}
            {lookupProfile.bio && <p><span className="font-medium text-gray-800">Bio:</span> {lookupProfile.bio}</p>}
            {lookupProfile.location && <p><span className="font-medium text-gray-800">Location:</span> {lookupProfile.location}</p>}
            {lookupProfile.skills && <p><span className="font-medium text-gray-800">Skills:</span> {lookupProfile.skills}</p>}
            {lookupSocials.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {lookupSocials.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full px-2.5 py-1 transition-colors">{s.platform}</a>
                ))}
              </div>
            )}
            <p>
              <span className="font-medium text-gray-800">Reviews:</span> {lookupReviewCount?.toString() || "0"}
              {lookupBreakdown && (
                <span className="ml-2 text-xs">
                  <span className="text-emerald-600">{Number(lookupBreakdown.pos)} pos</span>
                  {" / "}
                  <span className="text-red-500">{Number(lookupBreakdown.neg)} neg</span>
                </span>
              )}
            </p>
            {lookupReviews.length > 0 && (
              <div className="space-y-2 mt-2">
                <p className="font-medium text-gray-800 text-xs uppercase tracking-wider">Recent Reviews</p>
                {lookupReviews.map((r, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center gap-1 text-amber-500 text-sm">
                      {Array.from({ length: Number(r.rating) }, (_, j) => <span key={j}>★</span>)}
                      {r.disputed && !r.upheld && (
                        <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Disputed</span>
                      )}
                      {r.upheld && (
                        <span className="ml-2 text-[10px] bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5">Removed</span>
                      )}
                    </div>
                    {r.comment && <p className="text-xs text-gray-600 mt-1">{r.comment}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(Number(r.timestamp) * 1000).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
            {lookupReviews.length === 0 && <p className="text-xs text-gray-400 italic">No reviews yet.</p>}
          </div>
        )}
      </section>

      {/* Submit Review */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Submit Review</h3>
        <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          You can only review users you have a completed deal with on the platform. Reviews are limited to one per day.
        </p>
        <input value={reviewAddr} onChange={e => setReviewAddr(e.target.value)} placeholder="User address 0x..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rating:</span>
          <select value={rating} onChange={e => setRating(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
          </select>
          {rating <= 3 && <span className="text-xs text-red-500">Negative review (can be disputed)</span>}
          {rating >= 4 && <span className="text-xs text-emerald-600">Positive review</span>}
        </div>
        <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comment (optional, max 500)" rows={3} maxLength={500} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
        <button
          onClick={handleReview}
          disabled={!canReview || !iInteracted}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Submit Review
        </button>
        {(!canReview || !iInteracted) && (
          <p className="text-xs text-amber-600">
            {!iInteracted
              ? "Interact with the platform first (create a project, gig, or listing)."
              : "You can only review users with a completed deal."}
          </p>
        )}
      </section>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {txHash && <TxStatus hash={txHash} status={txStatus} />}
    </div>
  );
}
