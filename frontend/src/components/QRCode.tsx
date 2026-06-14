import { LINKS } from "../config/contracts";

type Props = {
  value?: string;
  size?: number;
};

export default function QRCode({ value = LINKS.rewardSite, size = 140 }: Props) {
  return (
    <div className="bg-white p-2 rounded-xl shadow-lg border border-gray-100 text-center">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=059669&bgcolor=ffffff&ecc=M`}
        alt="QR Code"
        width={size}
        height={size}
        className="rounded-lg mx-auto"
      />
      <p className="text-[9px] text-gray-400 mt-1 font-medium">
        Scan with phone wallet
      </p>
    </div>
  );
}
