/**
 * Outgoing message templates: the "your variety was found" email (design §4 outline) and text
 * (§4a), the one-time verification code email/text (§2a/§4a), and the admin notice for a new Add
 * Your Farm submission (§9). Plain functions → { subject, html, text } / string. No tracking
 * pixels; the only image is the self-hosted Hues dahlia mark from this site.
 */
import { escapeHtml, type OutgoingEmail } from "@/lib/mail";

export const FARM_FOOTER = "Hues Floral Park, 93485 River Road, Junction City, OR";
const MARK_PATH = "/brand/hues-dahlia-mark.png";

export interface FoundItem {
  varietyId: number;
  varietyName: string;
  varietySlug: string;
  crop: string;
  sellerName: string;
  listingId: number;
  unsubscribeUrl: string;
}

function shell(site: string, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Seed Directory</title></head>
<body style="margin:0;background:#f8f1e1;color:#2e2a23;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f1e1;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf7;border:1px solid #e3d8bd;border-radius:14px;">
<tr><td style="padding:20px 24px 8px 24px;">
<img src="${site}${MARK_PATH}" width="48" height="48" alt="Hues Floral Park" style="display:inline-block;vertical-align:middle;border:0;">
<span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:18px;font-weight:600;color:#1e4634;">Seed Directory</span>
<span style="display:inline-block;vertical-align:middle;margin-left:6px;font-size:13px;color:#6a5f4c;">· by Hues Floral Park</span>
</td></tr>
<tr><td style="padding:8px 24px 16px 24px;font-size:16px;line-height:1.55;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px 20px 24px;border-top:1px solid #e3d8bd;font-size:13px;line-height:1.5;color:#6a5f4c;">${footerHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

export function foundEmail(opts: {
  site: string;
  to: string;
  name: string;
  items: FoundItem[];
  listCount: number;
  unsubscribeAllUrl: string;
  oneClickUrl: string;
}): OutgoingEmail {
  const { site, items } = opts;
  const first = items[0]!;
  const subject = items.length === 1 ? `Good news — ${first.varietyName} seeds found` : `Good news — ${items.length} of your varieties were found`;
  const goUrl = (i: FoundItem) => `${site}/go/${i.listingId}`;
  const hi = opts.name.trim() ? `Hi ${escapeHtml(opts.name.trim().split(/\s+/)[0]!)},` : "Hello,";
  const lead =
    items.length === 1
      ? `<p>${hi}</p><p>You asked us to watch for <strong>${escapeHtml(first.varietyName)}</strong> (${escapeHtml(first.crop)}). It’s now listed by ${escapeHtml(first.sellerName)} — <a href="${goUrl(first)}" style="color:#1f5c3d;">see it at ${escapeHtml(first.sellerName)}</a>.</p>`
      : `<p>${hi}</p><p>${items.length} of the varieties you asked us to watch for are now listed:</p><ul style="padding-left:20px;">${items
          .map(
            (i) =>
              `<li style="margin:6px 0;"><strong>${escapeHtml(i.varietyName)}</strong> (${escapeHtml(i.crop)}) — listed by ${escapeHtml(i.sellerName)}: <a href="${goUrl(i)}" style="color:#1f5c3d;">see it</a></li>`,
          )
          .join("")}</ul>`;
  const note = `<p style="font-size:14px;color:#4a4438;">Stock changes quickly — check the seller’s own page before ordering.</p>`;
  const lists = `You’re on the waiting list for ${opts.listCount} ${opts.listCount === 1 ? "variety" : "varieties"}.`;
  const per = items.map((i) => `<a href="${i.unsubscribeUrl}" style="color:#6a5f4c;">unsubscribe from ${escapeHtml(i.varietyName)}</a>`).join(" · ");
  const footer = `<p style="margin:0 0 8px 0;">${lists} <a href="${site}/account" style="color:#6a5f4c;">Manage your waiting lists</a> · ${per} · <a href="${opts.unsubscribeAllUrl}" style="color:#6a5f4c;">unsubscribe from all</a></p>
<p style="margin:0;">${FARM_FOOTER} · You got this email because you joined a waiting list at seeds.hues.flowers.</p>`;

  const textItems =
    items.length === 1
      ? `You asked us to watch for ${first.varietyName} (${first.crop}). It's now listed by ${first.sellerName}: ${goUrl(first)}`
      : `${items.length} of the varieties you asked us to watch for are now listed:\n${items.map((i) => `- ${i.varietyName} (${i.crop}) — ${i.sellerName}: ${goUrl(i)}`).join("\n")}`;
  const text = `${hi.replace(/<[^>]+>/g, "")}

${textItems}

Stock changes quickly — check the seller's own page before ordering.

${lists} Manage your waiting lists: ${site}/account
${items.map((i) => `Unsubscribe from ${i.varietyName}: ${i.unsubscribeUrl}`).join("\n")}
Unsubscribe from all: ${opts.unsubscribeAllUrl}

${FARM_FOOTER}
You got this email because you joined a waiting list at seeds.hues.flowers.`;
  return {
    to: opts.to,
    subject,
    html: shell(site, `${lead}${note}`, footer),
    text,
    headers: { "List-Unsubscribe": `<${opts.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export function foundSms(o: { varietyName: string; crop: string; sellerName: string; site: string; varietySlug: string }): string {
  return `Seed Directory: ${o.varietyName} (${o.crop}) is now listed by ${o.sellerName} — ${o.site}/variety/${o.varietySlug}`;
}

export function codeEmail(o: { site: string; to: string; code: string; minutes: number }): OutgoingEmail {
  const html = `<p>Your Seed Directory verification code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1e4634;margin:12px 0;font-family:'Courier New',monospace;">${o.code}</p>
<p>Type it on the Seed Directory page that asked for it. It works once and expires in ${o.minutes} minutes. Verifying your email switches on your waiting-list alerts.</p>
<p style="font-size:14px;color:#4a4438;">This code only confirms your email address — you never need a code to sign in. If you didn’t create a Seed Directory account, you can ignore this email.</p>`;
  return {
    to: o.to,
    subject: "Your Seed Directory verification code",
    html: shell(o.site, html, `<p style="margin:0;">${FARM_FOOTER}</p>`),
    text: `Your Seed Directory verification code is ${o.code}

Type it on the Seed Directory page that asked for it. It works once and expires in ${o.minutes} minutes. Verifying your email switches on your waiting-list alerts.

This code only confirms your email address — you never need a code to sign in. If you didn't create a Seed Directory account, you can ignore this email.

${FARM_FOOTER}`,
  };
}

export const codeSms = (code: string, minutes: number) =>
  `Seed Directory: your alert-number code is ${code}. It expires in ${minutes} minutes. Msg & data rates may apply. Reply STOP to end, HELP for help.`;

/**
 * Admin sign-in code (Slice 0): the admin flow's only code email. Unlike the account
 * verification code, this one IS part of signing in — the copy says so, and pointedly
 * does not repeat the account code's "never need a code to sign in" line.
 */
export function adminCodeEmail(o: { site: string; to: string; code: string; minutes: number }): OutgoingEmail {
  const html = `<p>Your Seed Directory admin sign-in code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#1e4634;margin:12px 0;font-family:'Courier New',monospace;">${o.code}</p>
<p>Type it on the admin sign-in page. It works once and expires in ${o.minutes} minutes.</p>
<p style="font-size:14px;color:#4a4438;">If you didn’t ask for this code, you can ignore this email — your account is unchanged.</p>`;
  return {
    to: o.to,
    subject: "Your admin sign-in code",
    html: shell(o.site, html, `<p style="margin:0;">${FARM_FOOTER}</p>`),
    text: `Your Seed Directory admin sign-in code is ${o.code}\n\nType it on the admin sign-in page. It works once and expires in ${o.minutes} minutes.\n\nIf you didn't ask for this code, you can ignore this email — your account is unchanged.\n\n${FARM_FOOTER}`,
  };
}

export function farmSubmissionAdminEmail(o: { site: string; to: string; id: number; farmName: string; city: string; state: string; website: string; contactName: string; contactEmail: string; declared: boolean }): OutgoingEmail {
  const rows = [
    ["Farm", o.farmName],
    ["Where", `${o.city}, ${o.state}`],
    ["Website", o.website],
    ["Contact", `${o.contactName} <${o.contactEmail}>`],
    ["Signed-in account declared farm owner", o.declared ? "yes" : "no"],
  ];
  return {
    to: o.to,
    subject: `New Add Your Farm submission: ${o.farmName}`,
    html: shell(
      o.site,
      `<p>A farm was submitted for review (#${o.id}).</p><table role="presentation" cellpadding="4">${rows.map(([k, v]) => `<tr><td style="color:#6a5f4c;">${escapeHtml(k!)}</td><td>${escapeHtml(v!)}</td></tr>`).join("")}</table><p><a href="${o.site}/admin/waitlist" style="color:#1f5c3d;">Open the review queue</a></p>`,
      `<p style="margin:0;">Seed Directory admin notice.</p>`,
    ),
    text: `A farm was submitted for review (#${o.id}).\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReview queue: ${o.site}/admin/waitlist`,
  };
}
