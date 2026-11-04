import {
  CourseReleaseNotFoundError,
  readCourseManifest,
} from '@/lib/course/repository';

const RELEASE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/;

export async function GET(request: Request) {
  const release = new URL(request.url).searchParams.get('release') || undefined;
  if (release && !RELEASE_ID_PATTERN.test(release))
    return Response.json({ error: 'Invalid course release.' }, { status: 400 });
  try {
    const data = await readCourseManifest(release);
    return Response.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'X-Course-Release': data.releaseId,
      },
    });
  } catch (error) {
    if (error instanceof CourseReleaseNotFoundError)
      return Response.json(
        { error: 'This course release is unavailable.' },
        { status: 404 },
      );
    return Response.json(
      {
        error:
          'The course could not be loaded. Please retry; your study progress is unaffected.',
      },
      { status: 503 },
    );
  }
}
