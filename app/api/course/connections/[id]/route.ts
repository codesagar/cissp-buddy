import {
  CourseConnectionNotFoundError,
  CourseConnectionsNotFoundError,
  CourseReleaseNotFoundError,
  readCourseConnection,
} from '@/lib/course/repository';

const CONNECTION_ID_PATTERN =
  /^cross-[a-z0-9]+(?:-[a-z0-9]+)*--[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELEASE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const release = new URL(request.url).searchParams.get('release') || undefined;
  if (!CONNECTION_ID_PATTERN.test(id))
    return Response.json({ error: 'Invalid course connection.' }, { status: 400 });
  if (release && !RELEASE_ID_PATTERN.test(release))
    return Response.json({ error: 'Invalid course release.' }, { status: 400 });
  try {
    const data = await readCourseConnection(id, release);
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
    if (error instanceof CourseConnectionNotFoundError)
      return Response.json(
        { error: 'This course connection is unavailable.' },
        { status: 404 },
      );
    return Response.json(
      {
        error:
          'The course connection could not be loaded. Please retry; your study progress is unaffected.',
      },
      { status: 503 },
    );
  }
}
