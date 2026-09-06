import { readCurriculum } from '@/lib/content/repository';
export async function GET(request: Request) {
  try {
    const release =
      new URL(request.url).searchParams.get('release') || undefined;
    const data = await readCurriculum(release);
    return Response.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Content-Release': data.releaseId,
      },
    });
  } catch {
    return Response.json(
      {
        error:
          'The curriculum could not be loaded. Please try again; your study progress is unaffected.',
      },
      { status: 503 },
    );
  }
}
