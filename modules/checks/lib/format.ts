/** Shared formatting helpers used across all UI pages */

export function fmtPHP(n: number | null | undefined): string {
  if (n == null) return '—';
  return '₱' + Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric',
  });
}

/** Format an ISO timestamp to Philippine time (UTC+8), e.g. "2026-07-01 10:58" */
export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  // Convert to PH time (UTC+8)
  return d.toLocaleString('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(',', '').replace('T', ' ').slice(0, 16);
}

/** Regex matching a UUID (v4-style), used to detect unresolved user IDs. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Known user email -> display name map */
const KNOWN_USERS: Record<string, string> = {
  'markimperial@esprintmedia.com': 'Mark Imperial',
  'espmi.juliesedoriosa@gmail.com': 'Julie Sedoriosa',
  'esprint.johncarl@gmail.com': 'John Carl Viray',
  'esprint.maricel20@gmail.com': 'Maricel Pineda',
  'espmi.catlyn@gmail.com': 'Catlyn Noche',
  'espmi.jeffrey@gmail.com': 'Jeffrey Pasa Azutillo',
  'espmi.camille@gmail.com': 'Camille Navarro',
  'espmi.arc@gmail.com': 'Arc Noland Timbol',
  'esprint.cyrus@gmail.com': 'Cyrus Chuaquico',
  'espmi.joanne@gmail.com': 'Joanne Pujante',
  'espmi.angela@gmail.com': 'Angela P. Aquino',
  'espmi.monandrei@gmail.com': 'Mon Andrei D. Serrano',
  'espmi.renz@gmail.com': 'Renz Hernandez',
  'escgi.maryjoybdignos@gmail.com': 'Mary Joy Dignos',
  'escgi.sybelle@gmail.com': 'Sybelle R. Ibañez',
  'escgi.jucel@gmail.com': 'Jucel A. Borje',
  'escgi.ivanjarvis@gmail.com': 'Ivan Jarvis Llantos',
  'esgci.merrychellebless@gmail.com': 'Merrychelle Bless S. Balla',
  'escgi.armie@gmail.com': 'Armie Grace Tobias Esta',
  'esprint.joemhari@gmail.com': 'Joe Mhari Lacanienta',
  'esprint.aireenmae@gmail.com': 'Aireen Mae I. Marcos',
  'escgi.cherrylou@gmail.com': 'Cherry Lou T. Ocampo',
  'escgi.marielasarol@gmail.com': 'Mariela Sarol',
  'apsi.remelyn@gmail.com': 'Remelyn Quero',
  'esprint.anniesa26@gmail.com': 'Anniesa Fuentes',
  'esprint.jasmineitang@gmail.com': 'Jasmine Itang',
  'apsi.christian@gmail.com': 'Christian Angel A. Sagarino',
  'apsi.keeshann@gmail.com': 'Keesh Montero',
  'apsi.graciamae@gmail.com': 'Gracia Mae Aguilar',
  'apsi.cassandra@gmail.com': 'Cassandra Antonares',
  'apsi.maygrace@gmail.com': 'May Grace Divino',
  'esprint.jenny@gmail.com': 'Jenny Sy',
  'espii.christianangel@gmail.com': 'Christian Angel A. Sagarino',
  'espii.michellea@gmail.com': 'Michelle Mae Titoy Alegarbes',
  'espii.jeffralde@gmail.com': 'Jeffrald V. Escandallo',
  'esprint.krizzia@gmail.com': 'Krizzia Azalea Gabayno',
  'espii.frederick@gmail.com': 'Frederick M. Sumalinog',
  'espii.aprilangelie@gmail.com': 'April Angelie Salonoy',
  'espii.sondrapagaspas@gmail.com': 'Sondra Lourdes Pagaspas',
  'esprint.misbah@gmail.com': 'Misbah M. Donaire',
  'esprint.ruby@gmail.com': 'Ruby Jane Esperat',
  'espii.iraneil@gmail.com': 'Ira Neil Minoras',
  'esprint.novojeric@gmail.com': 'Novo jeric Pedregosa',
  'espii.stephaniee@gmail.com': 'Stephanie Anima',
  'espii.roxan@gmail.com': 'Roxan Cabillo',
  'eileen@esprintmedia.com': 'Eileen So Kua',
  'kesia@esprintmedia.com': 'Kesia Lyka Reña',
  'espmi.kesialyka@gmail.com': 'Kesia Lyka Reña',
  'espmi.maryrose@gmail.com': 'Mary Rose Pangan',
};

/**
 * Display a "recorded/encoded by" value. Older migrated rows may still carry a
 * raw Supabase user UUID (when the original user was deleted and could not be
 * resolved to a name). Show "Deleted user" instead of a meaningless ID.
 * If an email is provided, resolves to the user's Full Name.
 */
export function displayUser(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v || UUID_RE.test(v)) return 'Deleted user';
  const lower = v.toLowerCase();
  if (KNOWN_USERS[lower]) return KNOWN_USERS[lower];
  return v;
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const EVENT_LABELS: Record<string, string> = {
  HOLD_REQUEST:    'Hold Request',
  RETURN:          'Return',
  PARTIAL_PAYMENT: 'Partial Payment',
  DEPOSIT_CLEARED: 'Deposit Cleared',
  REPLACEMENT:     'Replacement',
  DEPOSITED:       'Deposited',
  CANCELLATION:    'Cancellation',
  ALTERATION:      'Alteration',
  LEGAL:           'Legal Action',
  RECONSTRUCT:     'Reconstruct',
  NOTE:            'Note',
};

export const RETURN_REASONS = [
  'DAIF','DAUD','DAIF/DAUD','DAUD/DAIF','DAIF/ACCOUNT CLOSED','DAUD/ACCOUNT CLOSED',
  'TWICE DAIF','ACCT CLOSED','STOP PAYMENT',
  'SIGNATURE MISMATCH','POSTDATED','STALE','ENDORSEMENT IRREGULAR',
  'UNDER GARNISHMENT',"CAN'T OUS","TWICE CAN'T OUS",'DORMANT ACCOUNT','ALT. - AWFD','BSP MEMO','UNAUTHORIZED SIGNATORY','OTHER',
];

export const PAYMENT_METHODS = [
  'CASH','BANK TRANSFER (BTB)','GCASH','MAYA','CREDIT MEMO','REPLACEMENT CHECK','OTHER',
];

/** Methods for "Settle Paid" — all except REPLACEMENT CHECK */
export const SETTLE_METHODS = [
  'CASH','BANK TRANSFER (BTB)','GCASH','MAYA','CREDIT MEMO','OTHER',
];

/** Methods for "Mark Replaced" — REPLACEMENT CHECK and OTHER only */
export const REPLACE_METHODS = [
  'REPLACEMENT CHECK','OTHER',
];

export const PAYMENT_FOR_OPTIONS = ['MACHINE', 'CONS', 'PARTS', 'OTHERS', 'RECONSTRUCT BALANCE'];

export const STALE_DAYS = 180;
