// ISO 20022 gateway (L5), a deliberately small subset:
//   in : pacs.008.001.08  FIToFICstmrCdtTrf  (one transaction per message)
//   out: pacs.002.001.10  FIToFIPmtStsRpt    (ACSC settled / RJCT with a reason code)
// The parser handles the plain, un-prefixed form of these messages and rejects anything it does not
// understand rather than guessing. It refuses DTDs and entities outright (no XXE surface).
// Reason-code mapping is a first pass and must be checked against the Payments Canada / Lynx usage
// guidelines before use [verify].

import crypto from 'node:crypto';

const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export class IsoError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'IsoError';
  }
}

function inner(xml, name, { required = true } = {}) {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  if (!m) {
    if (required) throw new IsoError(`missing element <${name}>`);
    return null;
  }
  return m[1];
}
const text = (xml, name) => {
  const v = inner(xml, name);
  if (/[<>]/.test(v)) throw new IsoError(`<${name}> must contain text only`);
  return unesc(v.trim());
};

export function parsePacs008(xml) {
  if (typeof xml !== 'string' || xml.length > 20000) throw new IsoError('message missing or too large');
  if (/<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xml)) throw new IsoError('DTDs, entities and CDATA are not accepted');
  if (!/<Document[^>]*xmlns="urn:iso:std:iso:20022:tech:xsd:pacs\.008\.001\.08"/.test(xml)) throw new IsoError('not a pacs.008.001.08 document');
  const root = inner(xml, 'FIToFICstmrCdtTrf');
  const hdr = inner(root, 'GrpHdr');
  const msgId = text(hdr, 'MsgId');
  const nb = text(hdr, 'NbOfTxs');
  const txs = [...root.matchAll(/<CdtTrfTxInf(?:\s[^>]*)?>([\s\S]*?)<\/CdtTrfTxInf>/g)].map((m) => m[1]);
  if (nb !== String(txs.length)) throw new IsoError(`NbOfTxs ${nb} does not match ${txs.length} transaction(s)`);
  if (txs.length !== 1) throw new IsoError('exactly one CdtTrfTxInf per message is supported');
  const t = txs[0];
  const pmt = inner(t, 'PmtId');
  const uetr = text(pmt, 'UETR');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uetr)) throw new IsoError('UETR must be a version-4 UUID');
  const amtEl = /<IntrBkSttlmAmt\s+Ccy="([A-Z]{3})">([^<]*)<\/IntrBkSttlmAmt>/.exec(t);
  if (!amtEl) throw new IsoError('missing IntrBkSttlmAmt with Ccy');
  if (amtEl[1] !== 'CAD') throw new IsoError(`currency ${amtEl[1]} not supported (CAD only)`);
  if (!/^\d{1,13}\.\d{2}$/.test(amtEl[2].trim())) throw new IsoError('amount must be decimal with exactly two fractional digits');
  const acct = (blockName) => {
    const m = /<Othr>\s*<Id>([^<]*)<\/Id>\s*<\/Othr>/.exec(inner(t, blockName));
    if (!m || !m[1].trim()) throw new IsoError(`missing account identification in <${blockName}>`);
    return unesc(m[1].trim());
  };
  return {
    msgId,
    endToEndId: text(pmt, 'EndToEndId'),
    instrId: text(pmt, 'InstrId'),
    uetr,
    amount: amtEl[2].trim(),
    debtor: { name: text(inner(t, 'Dbtr'), 'Nm'), account: acct('DbtrAcct') },
    creditor: { name: text(inner(t, 'Cdtr'), 'Nm'), account: acct('CdtrAcct') },
  };
}

export const centsOf = (s) => {
  const [d, c] = s.split('.');
  return BigInt(d) * 100n + BigInt(c);
};

// kernel/bank rejection -> ISO ExternalStatusReason1Code
export const REASON = {
  INSUFFICIENT_FUNDS: ['AM04', 'insufficient funds'],
  INSUFFICIENT_SETTLEMENT_POSITION: ['AM04', 'payer settlement position too low'],
  VALUE_CAP_EXCEEDED: ['AM02', 'amount above the per-instruction limit'],
  ACCOUNT_FROZEN: ['AC06', 'account blocked'],
  UNKNOWN_ACCOUNT: ['AC01', 'incorrect account number'],
  DUPLICATE_INSTRUCTION: ['DUPL', 'duplicate payment'],
  SANCTIONS_HIT: ['RR04', 'regulatory reason'],
  KYC_EXPIRED: ['RR04', 'regulatory reason'],
  NETWORK_HALTED: ['NARR', 'network halted'],
  ISSUER_QUARANTINED: ['NARR', 'issuer suspended'],
  BAD_SIGNATURE: ['NARR', 'authentication failed'],
};

const iso = (d = new Date()) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function buildPacs002({ msgId, endToEndId, uetr, settled, error, message, height, hash, time }) {
  const [code, reason] = error ? REASON[error] || ['NARR', error] : [null, null];
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>${esc('STS-' + (uetr || msgId || 'unknown').slice(0, 30))}</MsgId>
      <CreDtTm>${iso(time ? new Date(time * 1000) : new Date())}</CreDtTm>
    </GrpHdr>
    <OrgnlGrpInfAndSts>
      <OrgnlMsgId>${esc(msgId || 'unknown')}</OrgnlMsgId>
      <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
    </OrgnlGrpInfAndSts>
    <TxInfAndSts>
      <OrgnlEndToEndId>${esc(endToEndId || 'unknown')}</OrgnlEndToEndId>
      <OrgnlUETR>${esc(uetr || '')}</OrgnlUETR>
      <TxSts>${settled ? 'ACSC' : 'RJCT'}</TxSts>${
        settled
          ? `\n      <ClrSysRef>${esc(hash.slice(0, 35))}</ClrSysRef>\n      <AddtlInf>Final in block ${height}; ledger-accepted (simulated consensus)</AddtlInf>`
          : `\n      <StsRsnInf><Rsn><Cd>${code}</Cd></Rsn><AddtlInf>${esc(message || reason)}</AddtlInf></StsRsnInf>`
      }
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>
`;
}

export function samplePacs008({ from = 'MPL:acme', to = 'NSR:cedar', amount = '25000.00', uetr, msgId = 'MSG-0001', fromName = 'Acme Manufacturing', toName = 'Cedar Foods' } = {}) {
  const u = uetr || crypto.randomUUID();
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${esc(msgId)}</MsgId>
      <CreDtTm>${iso()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>INSTR-${esc(msgId)}</InstrId>
        <EndToEndId>E2E-${esc(msgId)}</EndToEndId>
        <UETR>${u}</UETR>
      </PmtId>
      <IntrBkSttlmAmt Ccy="CAD">${esc(amount)}</IntrBkSttlmAmt>
      <Dbtr><Nm>${esc(fromName)}</Nm></Dbtr>
      <DbtrAcct><Id><Othr><Id>${esc(from)}</Id></Othr></Id></DbtrAcct>
      <Cdtr><Nm>${esc(toName)}</Nm></Cdtr>
      <CdtrAcct><Id><Othr><Id>${esc(to)}</Id></Othr></Id></CdtrAcct>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>
`;
}
