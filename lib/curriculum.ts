import lessonData from './data/lessons.json';
import questionData from './data/questions.json';
import edgeData from './data/edges.json';
export type Lesson = {
  id: string;
  title: string;
  subtitle: string;
  domain: number;
  minutes: number;
  objective: string;
  summary: string;
  sections: { title: string; body: string }[];
  analogy: string;
  misconception: { wrong: string; right: string };
  takeaway: string;
  recall: { question: string; answer: string };
  sources: { title: string; url: string }[];
  review: { status: string; date: string; note: string };
};
export type Question = {
  id: string;
  conceptId: string;
  variant: number;
  stem: string;
  options: string[];
  correctIndex: number;
  explanations: string[];
  decisiveDetail: string;
  takeaway: string;
  source: { title: string; url: string };
  review: { status: string; date: string };
};
export const lessons = lessonData as Lesson[];
export const questions = questionData as Question[];
export const edges = edgeData as { from: string; to: string; label: string }[];
export const domains = [
  {
    id: 1,
    name: 'Security & Risk Management',
    short: 'Risk management',
    weight: 16,
    color: '#bb8860',
  },
  {
    id: 2,
    name: 'Asset Security',
    short: 'Asset security',
    weight: 10,
    color: '#9981ac',
  },
  {
    id: 3,
    name: 'Security Architecture & Engineering',
    short: 'Architecture',
    weight: 13,
    color: '#798aa5',
  },
  {
    id: 4,
    name: 'Communication & Network Security',
    short: 'Network security',
    weight: 13,
    color: '#679da2',
  },
  {
    id: 5,
    name: 'Identity & Access Management',
    short: 'Identity & access',
    weight: 13,
    color: '#4d8261',
  },
  {
    id: 6,
    name: 'Security Assessment & Testing',
    short: 'Assessment & testing',
    weight: 12,
    color: '#a2905c',
  },
  {
    id: 7,
    name: 'Security Operations',
    short: 'Security operations',
    weight: 13,
    color: '#8d899f',
  },
  {
    id: 8,
    name: 'Software Development Security',
    short: 'Software security',
    weight: 10,
    color: '#9b857d',
  },
];
export const shortTitle = (id: string) =>
  ({
    identity: 'Digital identity',
    authentication: 'Authentication',
    authorization: 'Authorization',
    'access-models': 'Access models',
    'least-privilege': 'Least privilege',
    federation: 'Federation',
    'access-lifecycle': 'Access lifecycle',
    accountability: 'Accountability',
    risk: 'Risk management',
    classification: 'Data classification',
  })[id] || id;
