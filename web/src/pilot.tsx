import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import StudyApp from '../components/study-app';
import { AccountProvider } from '../lib/learner/account';
import { CurriculumProvider } from '../lib/content-provider';
import type { Curriculum } from '../lib/curriculum';
import { loadPilot, appUrl } from '../lib/course/static-loader';
import '../app/globals.css';
function Pilot() {
  const [data, setData] = useState<Curriculum | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadPilot(controller.signal)
      .then(setData)
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, [retry]);
  if (error)
    return (
      <main className="content-unavailable">
        <h1>The pilot could not load.</h1>
        <p>
          Your saved progress is untouched. Check your connection and try again.
        </p>
        <button
          onClick={() => {
            setError(false);
            setRetry(retry + 1);
          }}
        >
          Try again
        </button>
        <p>
          <a href={appUrl('#/backup')}>Open course backup and recovery</a>
        </p>
      </main>
    );
  if (!data)
    return (
      <main className="content-unavailable">
        <output>Loading the original pilot…</output>
      </main>
    );
  return (
    <CurriculumProvider data={data}>
      <StudyApp />
    </CurriculumProvider>
  );
}
createRoot(document.getElementById('root')!).render(
  <AccountProvider>
    <Pilot />
  </AccountProvider>,
);
