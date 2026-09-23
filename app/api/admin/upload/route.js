import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getProfile } from '../../../../lib/supabase/server';
import { isAdminRole } from '../../../../lib/roles';
import { parseUpload, uploadNote } from '../../../../lib/perf/ingest';
import { writeSnapshot } from '../../../../lib/perf/cache';

export const dynamic = 'force-dynamic';
// Parsing ~6 MB of JSON and writing it back takes longer than the default.
export const maxDuration = 60;

// Load a dataset by hand when the automatic pull cannot run.
//
// Same destination as /api/refresh, deliberately: the same parser, the same PII
// strip, the same writeSnapshot. The only difference is where the bytes came
// from and that the snapshot is stamped 'manual' with who uploaded it, so the
// history can always answer "where did these numbers come from".
export async function POST(request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isAdminRole(profile.role)) return NextResponse.json({ error: 'admins only' }, { status: 403 });

  let text = '';
  let filename = null;

  const type = request.headers.get('content-type') || '';
  if (type.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Choose a file first.' }, { status: 400 });
    }
    filename = file.name || null;
    text = await file.text();
  } else {
    const body = await request.json().catch(() => ({}));
    text = body?.text || '';
    filename = body?.filename || null;
  }

  // Parse and validate BEFORE touching the database. A file that would blank
  // the dashboard has to be refused while the current snapshot is still the
  // newest one, because there is no undo: pages read the latest row.
  let data;
  try {
    data = parseUpload(text);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  try {
    const saved = await writeSnapshot({
      kind: data.kind,
      leads: data.leads,
      accounts: data.accounts,
      notes: uploadNote({ email: profile.email, filename, shape: data.shape }),
    });
    revalidatePath('/console');
    revalidatePath('/console/reps');
    revalidatePath('/console/churn');
    revalidatePath('/console/admin/upload');
    return NextResponse.json({
      ok: true,
      ...saved,
      leads: data.leads.length,
      accounts: data.accounts.length,
      source: data.kind,
    });
  } catch (e) {
    console.error('manual upload: could not write snapshot', e);
    return NextResponse.json({
      error: `The file was read fine (${data.leads.length} leads, ${data.accounts.length} accounts) `
        + `but saving it failed: ${e.message}`,
    }, { status: 500 });
  }
}
