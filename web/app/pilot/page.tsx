import { readCurriculum } from '@/lib/content/repository';
import { CurriculumProvider } from '@/lib/content-provider';
import StudyApp from '@/components/study-app';
export default async function Page() {
  let curriculum;
  try {
    curriculum = await readCurriculum();
  } catch {
    return (
      <main className="content-unavailable">
        <h1>Your library is taking a moment.</h1>
        <p>
          The curriculum could not be loaded. Your saved progress is untouched.
        </p>
        {/* oxlint-disable-next-line next/no-html-link-for-pages -- Intentional full-document transition avoids Vinext beta's broken RSC prefetch shim. */}
        <a href="/">Try again</a>
      </main>
    );
  }
  return (
    <CurriculumProvider data={curriculum}>
      <StudyApp />
    </CurriculumProvider>
  );
}
