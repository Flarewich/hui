import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { listAdminRecipients, queueEmail } from "@/lib/email";
import { getCurrentSession } from "@/lib/sessionAuth";
import { createNotifications } from "@/lib/notifications";
import { createSponsorRequest, ensureSponsorRequestsTable } from "@/lib/sponsorRequests";
import { assertSameOriginRequest, consumeRateLimit, getRequestIp, isValidEmail, sanitizeTextInput } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await getCurrentSession();
  const user = session?.user;
  const profile = session?.profile;

  if (!user || !profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.is_blocked) {
    return NextResponse.json({ error: "Blocked" }, { status: 403 });
  }

  await ensureSponsorRequestsTable();

  const body = (await request.json().catch(() => null)) as
    | {
        fullName?: string;
        brandName?: string;
        contactEmail?: string;
        contactDetails?: string;
        offerSummary?: string;
      }
    | null;

  const fullName = sanitizeTextInput(body?.fullName, { maxLength: 120 });
  const brandName = sanitizeTextInput(body?.brandName, { maxLength: 160 });
  const contactEmail = sanitizeTextInput(body?.contactEmail, { maxLength: 160 }).toLowerCase();
  const contactDetails = sanitizeTextInput(body?.contactDetails, { maxLength: 500, multiline: true });
  const offerSummary = sanitizeTextInput(body?.offerSummary, { maxLength: 3000, multiline: true });

  if (!fullName || !contactEmail || !contactDetails || !offerSummary) {
    return NextResponse.json({ error: "All required fields must be filled." }, { status: 400 });
  }

  if (fullName.length > 120 || brandName.length > 160 || contactEmail.length > 160 || contactDetails.length > 500 || offerSummary.length > 3000) {
    return NextResponse.json({ error: "One or more fields exceed the allowed length." }, { status: 400 });
  }

  if (!isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const ipRate = await consumeRateLimit({
    action: "sponsor-request:ip",
    key: ip,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!ipRate.allowed) {
    return NextResponse.json({ error: "Too many sponsor requests. Try again later." }, { status: 429 });
  }

  const userRate = await consumeRateLimit({
    action: "sponsor-request:user",
    key: user.id,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!userRate.allowed) {
    return NextResponse.json({ error: "Too many sponsor requests. Try again later." }, { status: 429 });
  }

  const requestId = await createSponsorRequest({
    userId: user.id,
    fullName,
    brandName: brandName || null,
    contactEmail,
    contactDetails,
    offerSummary,
  });

  const adminRecipients = await listAdminRecipients();
  await createNotifications(
    adminRecipients.map((admin) => ({
      userId: admin.user_id,
      type: "sponsor_request_created",
      title: "New sponsor request",
      body: `${fullName} submitted a sponsor request.`,
      href: "/admin/sponsors",
    }))
  );

  for (const admin of adminRecipients) {
    await queueEmail({
      toEmail: admin.email,
      subject: "New sponsor request",
      textBody: `A new sponsor request was submitted by ${fullName}.\n\nBrand: ${brandName || "-"}\nEmail: ${contactEmail}\n\nOpen: /admin/sponsors`,
      kind: "sponsor_request_created",
      userId: admin.user_id,
      meta: { requestId },
    });
  }

  revalidatePath("/admin/sponsors");

  return NextResponse.json({ ok: true, requestId });
}
