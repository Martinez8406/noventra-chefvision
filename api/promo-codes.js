import '../lib/loadEnv.js';
import { handlePromoApi } from '../lib/promoHttp.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Verify-Session');
}

export {
  handlePromoCodes,
  handlePromoPin,
  handleVerifySession,
  handleVerifyCode,
  handleRedeemPromo,
  handlePromoApi,
} from '../lib/promoHttp.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const result = await handlePromoApi({
    req,
    authorization: req.headers.authorization || req.headers.Authorization,
    query: req.query || {},
    body: req.body || {},
    method: req.method,
  });
  return res.status(result.status).json(result.body);
}
