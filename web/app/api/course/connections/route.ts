import {
  CourseConnectionsNotFoundError,
  CourseReleaseNotFoundError,
  readCourseConnectionsIndex,
} from '@/lib/course/repository';

const RELEASE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function GET(request: Request) {
  const release = new URL(request.url).searchParams.get('release') || undefined;
  if (release && !RELEASE_ID_PATTERN.test(release))
    return Response.json({ error: 'Invalid course release.' }, { status: 400 });
  try {
    const data = await readCourseConnectionsIndex(release);
    return Response.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Course-Release': data.releaseId,
      },
    });
  } catch (error) {
    if (
      error instanceof CourseReleaseNotFoundError ||
      error instanceof CourseConnectionsNotFoundError
    )
      return Response.json(
        { error: 'These course connections are unavailable.' },
        { status: 404 },
      );
    return Response.json(
      {
        error:
          'The course connections could not be loaded. Please retry; your study progress is unaffected.',
      },
      { status: 503 },
    );
  }
}
