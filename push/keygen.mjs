// 生成一对 VAPID 密钥。公钥填进 wrangler.toml，私钥用 wrangler secret 保存，不要提交到仓库。
const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", k.privateKey);
const b64u = (b) => Buffer.from(b).toString("base64url");
console.log("VAPID_PUBLIC（填进 wrangler.toml）:\n" + b64u(pub) + "\n");
console.log("VAPID_PRIVATE_JWK（运行 npx wrangler secret put VAPID_PRIVATE_JWK 后粘贴）:\n" + JSON.stringify(jwk));
