import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { requireApiRoles, PERMISSIONS } from '@/lib/auth/api-guard';
import { getCurrentUserWithRoles, hasAnyRole } from '@/lib/auth/session';

const AddBookSchema = z.object({
  action: z.literal('ADD_BOOK'),
  title: z.string().min(2),
  author: z.string().min(2),
  isbn: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  book_format: z.enum(['FISIK', 'EBOOK', 'KEDUANYA']).default('FISIK'),
  total_copies: z.number().min(1).default(1),
  ebook_file_url: z.string().optional().nullable(),
  cover_url: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  is_premium: z.boolean().default(false),
  total_pages: z.number().int().min(1).default(20),
});

const ToggleBookPremiumSchema = z.object({
  action: z.literal('TOGGLE_BOOK_PREMIUM'),
  book_id: z.string().uuid(),
  is_premium: z.boolean(),
});

const GrantPremiumAccessSchema = z.object({
  action: z.literal('GRANT_PREMIUM_ACCESS'),
  book_id: z.string().uuid(),
  user_id: z.string().uuid(),
  duration_value: z.number().int().min(1).max(8760),
  duration_unit: z.enum(['JAM', 'HARI']).default('HARI'),
  notes: z.string().optional().nullable(),
});

const RevokePremiumAccessSchema = z.object({
  action: z.literal('REVOKE_PREMIUM_ACCESS'),
  grant_id: z.string().uuid(),
});

const RegisterPublicMemberSchema = z.object({
  action: z.literal('REGISTER_PUBLIC_MEMBER'),
  full_name: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional().nullable(),
});

const BorrowBookSchema = z.object({
  action: z.literal('BORROW_BOOK'),
  book_id: z.string().uuid(),
  member_id: z.string().uuid(),
  due_date: z.string(),
});

const ReturnBookSchema = z.object({
  action: z.literal('RETURN_BOOK'),
  loan_id: z.string().uuid(),
  fine_amount: z.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({
      books: [],
      members: [],
      loans: [],
      myGrants: [],
      grants: [],
      users: [],
    });
  }

  const isPublicMode = request.nextUrl.searchParams.get('public') === '1';
  const [session, supabase] = [await getCurrentUserWithRoles(), createSupabaseAdminClient()];

  const [{ data: rawBooks }, { data: members }, { data: loans }] = await Promise.all([
    supabase.from('library_books').select('*').order('title'),
    isPublicMode
      ? Promise.resolve({ data: [] })
      : supabase
          .from('library_members')
          .select(
            '*, profile:profiles(avatar_url), student:students(photo_url), teacher:teachers_staff(photo_url)'
          )
          .order('joined_at', { ascending: false })
          .limit(100),
    isPublicMode
      ? Promise.resolve({ data: [] })
      : supabase
          .from('library_loans')
          .select('*, book:library_books(title), member:library_members(full_name, member_code)')
          .order('created_at', { ascending: false })
          .limit(100),
  ]);

  const nowIso = new Date().toISOString();
  let myGrants: Array<Record<string, unknown>> = [];
  if (session) {
    const { data: gData } = await supabase
      .from('ebook_access_grants')
      .select('*')
      .eq('user_id', session.userId)
      .eq('is_revoked', false)
      .gt('expires_at', nowIso);
    myGrants = gData || [];
  }

  const isAdminOrLibrarian = session
    ? hasAnyRole(session, PERMISSIONS.PERPUSTAKAAN_MANAGE)
    : false;

  const myGrantMap = new Map(myGrants.map((g) => [g.book_id as string, g]));

  // Sanitize books: never expose raw ebook_file_url to public/non-manager clients
  const sanitizedBooks = (rawBooks || [])
    .filter((b) => !isPublicMode || b.book_format === 'EBOOK' || b.book_format === 'KEDUANYA')
    .map((b) => {
      const grant = myGrantMap.get(b.id as string);
      const isPremium = Boolean(b.is_premium);
      const hasPremiumAccess = !isPremium || isAdminOrLibrarian || Boolean(grant);
      return {
        ...b,
        ebook_file_url: isAdminOrLibrarian ? b.ebook_file_url : null,
        has_ebook: Boolean(b.ebook_file_url),
        is_premium: isPremium,
        has_premium_access: hasPremiumAccess,
        grant_expires_at: grant ? grant.expires_at : null,
      };
    });

  if (isPublicMode || !session) {
    return NextResponse.json({
      books: sanitizedBooks,
      members: [],
      loans: [],
      myGrants,
      grants: [],
      users: [],
    });
  }

  const canViewAllMembers = hasAnyRole(session, PERMISSIONS.PERPUSTAKAAN_ANGGOTA_VIEW);
  let grants: Array<Record<string, unknown>> = [];
  let users: Array<Record<string, unknown>> = [];

  if (isAdminOrLibrarian) {
    const [{ data: allGrants }, { data: allUsers }] = await Promise.all([
      supabase
        .from('ebook_access_grants')
        .select('*, book:library_books(id, title, is_premium), user:profiles!ebook_access_grants_user_id_fkey(id, full_name, email)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('account_status', 'AKTIF')
        .eq('is_active', true)
        .order('full_name')
        .limit(300),
    ]);
    grants = allGrants || [];
    users = allUsers || [];
  }

  const enrichedMembers = (members || []).map((m) => {
    const prof = Array.isArray(m.profile) ? m.profile[0] : m.profile;
    const stud = Array.isArray(m.student) ? m.student[0] : m.student;
    const teach = Array.isArray(m.teacher) ? m.teacher[0] : m.teacher;
    return {
      ...m,
      avatar_url: prof?.avatar_url || stud?.photo_url || teach?.photo_url || null,
    };
  });

  if (!canViewAllMembers) {
    const myTeacherId = session.teacherAssignments?.teacherId || null;
    const { data: myStudent } = session.roles.includes('SISWA')
      ? await supabase
          .from('students')
          .select('id')
          .eq('profile_id', session.userId)
          .maybeSingle()
      : { data: null };

    const myMembers = enrichedMembers.filter(
      (m) =>
        m.profile_id === session.userId ||
        (myTeacherId && m.teacher_id === myTeacherId) ||
        (myStudent?.id && m.student_id === myStudent.id) ||
        (session.email && m.email && m.email.toLowerCase() === session.email.toLowerCase())
    );
    const myMemberIds = new Set(myMembers.map((m) => m.id));
    const myLoans = (loans || []).filter((l) => myMemberIds.has(l.member_id));

    return NextResponse.json({
      books: sanitizedBooks,
      members: myMembers,
      loans: myLoans,
      myGrants,
      grants,
      users,
    });
  }

  return NextResponse.json({
    books: sanitizedBooks,
    members: enrichedMembers,
    loans: loans || [],
    myGrants,
    grants,
    users,
  });
}

export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    if (body.action === 'ADD_BOOK') {
      const guard = await requireApiRoles(PERMISSIONS.PERPUSTAKAAN_MANAGE);
      if (guard.errorResponse) return guard.errorResponse;
      const parsed = AddBookSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data buku tidak valid.' }, { status: 400 });
      }
      const payload = { ...parsed.data } as Record<string, unknown>;
      delete payload.action;
      const { data, error } = await supabase
        .from('library_books')
        .insert({
          ...payload,
          available_copies: parsed.data.total_copies,
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ book: data });
    }

    if (body.action === 'REGISTER_PUBLIC_MEMBER') {
      const parsed = RegisterPublicMemberSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data anggota umum tidak valid.' }, { status: 400 });
      }
      const randSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const memberCode = `LIB-U-${Date.now().toString().slice(-6)}-${randSuffix}`;
      const { data, error } = await supabase
        .from('library_members')
        .insert({
          member_code: memberCode,
          member_type: 'UMUM',
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          is_auto_registered: false,
          status: 'AKTIF',
        })
        .select('*')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ member: data });
    }

    if (body.action === 'BORROW_BOOK') {
      const guard = await requireApiRoles(PERMISSIONS.PERPUSTAKAAN_MANAGE);
      if (guard.errorResponse) return guard.errorResponse;
      const parsed = BorrowBookSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data peminjaman tidak valid.' }, { status: 400 });
      }
      const { data: book } = await supabase
        .from('library_books')
        .select('id, available_copies')
        .eq('id', parsed.data.book_id)
        .single();

      if (!book || book.available_copies < 1) {
        return NextResponse.json({ error: 'Stok buku tidak tersedia.' }, { status: 400 });
      }

      // Optimistic lock on available_copies to prevent concurrent over-borrowing
      const { data: decBook, error: decErr } = await supabase
        .from('library_books')
        .update({ available_copies: book.available_copies - 1 })
        .eq('id', book.id)
        .eq('available_copies', book.available_copies)
        .select('id')
        .maybeSingle();

      if (decErr || !decBook) {
        return NextResponse.json(
          { error: 'Stok buku berubah secara bersamaan. Silakan muat ulang dan coba lagi.' },
          { status: 409 }
        );
      }

      const { data: loan, error } = await supabase
        .from('library_loans')
        .insert({
          book_id: parsed.data.book_id,
          member_id: parsed.data.member_id,
          due_date: parsed.data.due_date,
          status: 'DIPINJAM',
        })
        .select('*')
        .single();
      if (error) {
        await supabase
          .from('library_books')
          .update({ available_copies: book.available_copies })
          .eq('id', book.id);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ loan });
    }

    if (body.action === 'RETURN_BOOK') {
      const guard = await requireApiRoles(PERMISSIONS.PERPUSTAKAAN_MANAGE);
      if (guard.errorResponse) return guard.errorResponse;
      const parsed = ReturnBookSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data pengembalian tidak valid.' }, { status: 400 });
      }
      const { data: loan } = await supabase
        .from('library_loans')
        .select('id, book_id, status')
        .eq('id', parsed.data.loan_id)
        .single();

      if (!loan || loan.status === 'DIKEMBALIKAN') {
        return NextResponse.json({ error: 'Peminjaman tidak ditemukan atau sudah dikembalikan.' }, { status: 400 });
      }

      const wibToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const { data: updatedLoan, error: retErr } = await supabase
        .from('library_loans')
        .update({
          return_date: wibToday,
          fine_amount: parsed.data.fine_amount,
          status: 'DIKEMBALIKAN',
        })
        .eq('id', loan.id)
        .eq('status', 'DIPINJAM')
        .select('id')
        .maybeSingle();

      if (retErr || !updatedLoan) {
        return NextResponse.json(
          { error: retErr?.message || 'Peminjaman sudah dikembalikan sebelumnya.' },
          { status: 409 }
        );
      }

      const { data: book } = await supabase
        .from('library_books')
        .select('available_copies, total_copies')
        .eq('id', loan.book_id)
        .single();

      if (book) {
        const nextCopies = Math.min(Number(book.total_copies ?? book.available_copies + 1), book.available_copies + 1);
        await supabase
          .from('library_books')
          .update({ available_copies: nextCopies })
          .eq('id', loan.book_id);
      }

      return NextResponse.json({ returned: true });
    }

    if (body.action === 'TOGGLE_BOOK_PREMIUM') {
      const guard = await requireApiRoles(PERMISSIONS.PERPUSTAKAAN_MANAGE);
      if (guard.errorResponse) return guard.errorResponse;
      const parsed = ToggleBookPremiumSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data status premium tidak valid.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('library_books')
        .update({ is_premium: parsed.data.is_premium })
        .eq('id', parsed.data.book_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (body.action === 'GRANT_PREMIUM_ACCESS') {
      const guard = await requireApiRoles(PERMISSIONS.PERPUSTAKAAN_MANAGE);
      if (guard.errorResponse) return guard.errorResponse;
      const parsed = GrantPremiumAccessSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Data izin akses premium tidak valid.' }, { status: 400 });
      }
      const durationHours =
        parsed.data.duration_unit === 'HARI'
          ? parsed.data.duration_value * 24
          : parsed.data.duration_value;
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('ebook_access_grants')
        .insert({
          book_id: parsed.data.book_id,
          user_id: parsed.data.user_id,
          granted_by: guard.session.userId,
          duration_hours: durationHours,
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          notes: parsed.data.notes?.trim() || null,
        })
        .select('*')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ grant: data });
    }

    if (body.action === 'REVOKE_PREMIUM_ACCESS') {
      const guard = await requireApiRoles(PERMISSIONS.PERPUSTAKAAN_MANAGE);
      if (guard.errorResponse) return guard.errorResponse;
      const parsed = RevokePremiumAccessSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'ID izin tidak valid.' }, { status: 400 });
      }
      const { error } = await supabase
        .from('ebook_access_grants')
        .update({ is_revoked: true })
        .eq('id', parsed.data.grant_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksi perpustakaan tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses perpustakaan.' }, { status: 500 });
  }
}
