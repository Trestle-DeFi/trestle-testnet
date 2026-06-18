const fs = require('fs');
let content = fs.readFileSync('vault.js', 'utf8');
content = content.replace(
  'if (!biometric) {\n    throw new Error("Biometric verification required for Virtual Vault withdrawal");\n  }',
  `if (!biometric) {
    throw new Error("Biometric verification required for Virtual Vault withdrawal");
  }

  const now = Math.floor(Date.now() / 1000);
  const VERIFICATION_TTL = 90 * 24 * 60 * 60; // 90 days in seconds
  if ((now - biometric.verified_at) > VERIFICATION_TTL) {
    throw new Error("Biometric verification expired - re-verify required");
  }`
);
fs.writeFileSync('vault.js', content);
echo "Patched"
