import {
  CourseReleaseNotFoundError,
  CourseUnitNotFoundError,
  readCourseUnit,
} from '@/lib/course/repository';

const UNIT_ID_PATTERN = /^d[1-8]-o\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELEASE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const release = new URL(request.url).searchParams.get('release') || undefined;
  if (!UNIT_ID_PATTERN.test(id))
    return Response.json({ error: 'Invalid course unit.' }, { status: 400 });
  if (release && !RELEASE_ID_PATTERN.test(release))
    return Response.json({ error: 'Invalid course release.' }, { status: 400 });
  try {
    const unit = await readCourseUnit(id, release);
    return Response.json(unit, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Course-Release': unit.releaseId,
      },
    });
  } catch (error) {
    if (error instanceof CourseReleaseNotFoundError)
      return Response.json(
        { error: 'This course release is unavailable.' },
        { status: 404 },
      );
    if (error instanceof CourseUnitNotFoundError)
      return Response.json(
        { error: 'This course unit is unavailable.' },
        { status: 404 },
      );
    return Response.json(
      {
        error:
          'The course unit could not be loaded. Please retry; your study progress is unaffected.',
      },
      { status: 503 },
    );
  }
}
