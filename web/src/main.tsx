import { createRoot } from 'react-dom/client';
import CourseApp from '../components/course-app';
import { AccountProvider } from '../lib/learner/account';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(
  <AccountProvider>
    <CourseApp />
  </AccountProvider>,
);
