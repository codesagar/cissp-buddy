import Link from 'next/link';
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
        <Link href="/">Try again</Link>
      </main>
    );
  }
  return (
    <CurriculumProvider data={curriculum}>
      <StudyApp />
    </CurriculumProvider>
  );
}
