import { NextResponse } from 'next/server';
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

export async function GET() {
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ books: [], members: [], loans: [] });
  }

  const [session, supabase] = [await getCurrentUserWithRoles(), createSupabaseAdminClient()];
  const [{ data: books }, { data: members }, { data: loans }] = await Promise.all([
    supabase.from('library_books').select('*').order('title'),
    supabase.from('library_members').select('*').order('joined_at', { ascending: false }).limit(100),
    supabase
      .from('library_loans')
      .select('*, book:library_books(title), member:library_members(full_name, member_code)')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (!session) {
    return NextResponse.json({
      books: books || [],
      members: [],
      loans: [],
    });
  }

  const canViewAllMembers = hasAnyRole(session, PERMISSIONS.PERPUSTAKAAN_ANGGOTA_VIEW);
  if (!canViewAllMembers) {
    const myTeacherId = session.teacherAssignments?.teacherId || null;
    const { data: myStudent } = session.roles.includes('SISWA')
      ? await supabase
          .from('students')
          .select('id')
          .eq('profile_id', session.userId)
          .maybeSingle()
      : { data: null };

    const myMembers = (members || []).filter(
      (m) =>
        m.profile_id === session.userId ||
        (myTeacherId && m.teacher_id === myTeacherId) ||
        (myStudent?.id && m.student_id === myStudent.id) ||
        (session.email && m.email && m.email.toLowerCase() === session.email.toLowerCase())
    );
    const myMemberIds = new Set(myMembers.map((m) => m.id));
    const myLoans = (loans || []).filter((l) => myMemberIds.has(l.member_id));

    return NextResponse.json({
      books: books || [],
      members: myMembers,
      loans: myLoans,
    });
  }

  return NextResponse.json({
    books: books || [],
    members: members || [],
    loans: loans || [],
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
      const { action: _, ...payload } = parsed.data;
      const { data, error } = await supabase
        .from('library_books')
        .insert({
          ...payload,
          available_copies: payload.total_copies,
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
      const memberCode = `LIB-U-${Date.now().toString().slice(-6)}`;
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
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase
        .from('library_books')
        .update({ available_copies: book.available_copies - 1 })
        .eq('id', book.id);

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

      await supabase
        .from('library_loans')
        .update({
          return_date: new Date().toISOString().slice(0, 10),
          fine_amount: parsed.data.fine_amount,
          status: 'DIKEMBALIKAN',
        })
        .eq('id', loan.id);

      const { data: book } = await supabase
        .from('library_books')
        .select('available_copies')
        .eq('id', loan.book_id)
        .single();

      if (book) {
        await supabase
          .from('library_books')
          .update({ available_copies: book.available_copies + 1 })
          .eq('id', loan.book_id);
      }

      return NextResponse.json({ returned: true });
    }

    return NextResponse.json({ error: 'Aksi perpustakaan tidak dikenal.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Gagal memproses perpustakaan.' }, { status: 500 });
  }
}
