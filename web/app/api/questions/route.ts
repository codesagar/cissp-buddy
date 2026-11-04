import { queryQuestions } from '@/lib/content/repository';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    domain = p.has('domain') ? Number(p.get('domain')) : undefined,
    offset = Number(p.get('offset') || 0),
    limit = Number(p.get('limit') || 25);
  if (
    (domain !== undefined &&
      (!Number.isInteger(domain) || domain < 1 || domain > 8)) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    return Response.json(
      { error: 'Invalid domain or pagination.' },
      { status: 400 },
    );
  try {
    const questions = await queryQuestions({
      domainId: domain,
      subtopicId: p.get('subtopic')?.slice(0, 100),
      offset,
      limit,
    });
    return Response.json(
      {
        questions,
        offset,
        nextOffset: questions.length === limit ? offset + limit : null,
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  } catch {
    return Response.json(
      { error: 'Practice questions unavailable. Please retry.' },
      { status: 503 },
    );
  }
}
