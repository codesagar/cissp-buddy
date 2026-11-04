import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

const enabled = process.env.CISSP_CLOUD_TESTS === '1';
const projectId = 'demo-cissp-buddy';
const productionRules = fs.readFileSync(
  new URL('../../firestore.rules', import.meta.url),
  'utf8',
);
const assignment = "let approvedUid = 'OWNER_UID_NOT_CONFIGURED';";
assert.equal(
  productionRules.split(assignment).length,
  2,
  'One explicit owner-configuration assignment',
);
const rules = productionRules.replace(
  assignment,
  "let approvedUid = 'owner-test';",
);
let environment;
let ownerDb;
const run = (name, work) => test(name, { skip: !enabled }, work);

before(async () => {
  if (!enabled) return;
  const address = process.env.FIRESTORE_EMULATOR_HOST || '';
  assert.match(
    address,
    /^(127\.0\.0\.1|localhost):\d+$/,
    'Security tests require a loopback Firestore emulator',
  );
  assert.equal(
    process.env.GCLOUD_PROJECT || projectId,
    projectId,
    'Tests never target a real project',
  );
  const [host, port] = address.split(':');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(port), rules },
  });
  ownerDb = environment.authenticatedContext('owner-test').firestore();
});
beforeEach(async () => {
  if (enabled) await environment.clearFirestore();
});
after(async () => {
  if (environment) await environment.cleanup();
});

const mainState = () => ({
  schemaVersion: 1,
  initialized: true,
  revision: 'revision-1',
  metadata: {
    version: 1,
    lastUnitId: null,
    preferences: {
      pace: 'step',
      experience: 'new',
      reducedMotion: false,
      theme: 'light',
    },
  },
});
const pilotState = () => ({
  schemaVersion: 1,
  initialized: true,
  revision: 'revision-1',
  metadata: { version: 1, visited: [], completed: [], active: null },
});
const check = {
  id: 'check-1',
  prompt: 'Which boundary enforces the denial?',
  hint: 'Identify the gate.',
  conceptIds: ['authorization'],
  options: [
    {
      id: 'gate',
      label: 'The enforcement gate',
      correct: true,
      feedback: 'The gate enforces the decision.',
      repairStateId: 'gate-step',
    },
    {
      id: 'identity',
      label: 'The identity claim',
      correct: false,
      feedback: 'Identity alone does not authorize access.',
      repairStateId: 'identity-step',
    },
  ],
};
const answer = () => ({
  order: 0,
  value: {
    id: 'attempt-1',
    unitId: 'unit-1',
    questionId: 'check-1',
    kind: 'prediction',
    selected: 'gate',
    correct: true,
    guess: false,
    hintUsed: false,
    outcomeViewed: false,
    at: 1000,
    releaseId: 'release-1',
    conceptIds: ['authorization'],
    snapshot: structuredClone(check),
  },
});
const position = () => ({
  stage: 'predict',
  step: 0,
  variant: 'base',
  visitedAt: 1000,
  note: '',
  checks: {
    'check-1': {
      selected: 'gate',
      guess: false,
      hintUsed: false,
      submittedAttemptId: 'attempt-1',
    },
  },
});
const review = () => ({
  dueAt: 259201000,
  intervalDays: 3,
  lastAt: 1000,
  needsReview: false,
});
const unit = () => ({ id: 'unit-1', position: position(), review: review() });
const pilotAnswer = () => ({
  order: 0,
  value: {
    id: 'session-1:0',
    questionId: 'pilot-question',
    conceptId: 'identity',
    chosen: 0,
    correct: true,
    guess: false,
    hintUsed: false,
    at: 1000,
    answerMs: 1200,
    explanationMs: 0,
    repeated: false,
    contentRelease: 'pilot-release',
    questionSnapshot: {
      stem: 'Who enforces the decision?',
      options: ['Gate', 'Claim', 'Label', 'Clock'],
      correctIndex: 0,
      explanations: [
        'Enforces it.',
        'Only an assertion.',
        'Not enforcement.',
        'Only time.',
      ],
    },
  },
});
const marker = (dataset = 'main') => ({
  schemaVersion: 1,
  status: 'importing',
  digest: 'a'.repeat(64),
  counts:
    dataset === 'main'
      ? { courseUnits: 1, courseAttempts: 1 }
      : { pilotAttempts: 0, pilotReviews: 0, pilotNotes: 0, pilotSessions: 0 },
});
const own = (db, path) => doc(db, 'users/owner-test/' + path);

run(
  'unconfigured production rules deny even the placeholder identity',
  async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    const unconfigured = await initializeTestEnvironment({
      projectId: 'demo-cissp-buddy-unconfigured',
      firestore: { host, port: Number(port), rules: productionRules },
    });
    try {
      const db = unconfigured
        .authenticatedContext('OWNER_UID_NOT_CONFIGURED')
        .firestore();
      await assertFails(
        setDoc(
          doc(db, 'users/OWNER_UID_NOT_CONFIGURED/state/main'),
          mainState(),
        ),
      );
      await assertFails(
        getDoc(doc(db, 'users/OWNER_UID_NOT_CONFIGURED/state/main')),
      );
    } finally {
      await unconfigured.cleanup();
    }
  },
);

run(
  'only the approved owner can get/list/create/update private records',
  async () => {
    await assertSucceeds(setDoc(own(ownerDb, 'state/main'), mainState()));
    await assertSucceeds(getDoc(own(ownerDb, 'state/main')));
    await assertSucceeds(
      getDocs(collection(ownerDb, 'users/owner-test/courseAttempts')),
    );
    for (const db of [
      environment.unauthenticatedContext().firestore(),
      environment.authenticatedContext('other-user').firestore(),
    ]) {
      await assertFails(getDoc(own(db, 'state/main')));
      await assertFails(
        getDocs(collection(db, 'users/owner-test/courseAttempts')),
      );
      await assertFails(setDoc(own(db, 'courseAttempts/attempt-1'), answer()));
      await assertFails(
        updateDoc(own(db, 'state/main'), { revision: 'other' }),
      );
      await assertFails(deleteDoc(own(db, 'state/main')));
    }
    const other = environment.authenticatedContext('other-user').firestore();
    await assertFails(
      setDoc(doc(other, 'users/other-user/state/main'), mainState()),
    );
    await assertFails(getDoc(doc(ownerDb, 'users/other-user/state/main')));
    await assertFails(getDocs(collection(ownerDb, 'users')));
    await assertFails(
      setDoc(own(ownerDb, 'unknown/record'), { secret: 'not allowed' }),
    );
  },
);

run(
  'owner saves an answer, its submitted reference and review in one valid atomic batch',
  async () => {
    const batch = writeBatch(ownerDb);
    batch.set(own(ownerDb, 'state/main'), mainState());
    batch.set(own(ownerDb, 'courseUnits/unit-1'), unit());
    batch.set(own(ownerDb, 'courseAttempts/attempt-1'), answer());
    await assertSucceeds(batch.commit());
    assert.equal(
      (await getDoc(own(ownerDb, 'courseUnits/unit-1'))).data().position.checks[
        'check-1'
      ].submittedAttemptId,
      (await getDoc(own(ownerDb, 'courseAttempts/attempt-1'))).data().value.id,
    );
    await assertSucceeds(
      setDoc(own(ownerDb, 'courseAttempts/attempt-1'), answer()),
    );
    const changed = answer();
    changed.value.snapshot.options[0].feedback = 'Rewritten history';
    await assertFails(
      setDoc(own(ownerDb, 'courseAttempts/attempt-1'), changed),
    );
    await assertSucceeds(
      updateDoc(own(ownerDb, 'courseAttempts/attempt-1'), { order: 1 }),
    );
    await assertFails(
      updateDoc(own(ownerDb, 'courseAttempts/attempt-1'), { order: -1 }),
    );
    await assertFails(deleteDoc(own(ownerDb, 'courseAttempts/attempt-1')));
  },
);

run(
  'malformed metadata, positions, unknown fields and inconsistent answer evidence are rejected',
  async () => {
    await assertFails(
      setDoc(own(ownerDb, 'state/main'), { ...mainState(), admin: true }),
    );
    await assertFails(
      setDoc(own(ownerDb, 'state/main'), {
        ...mainState(),
        initialized: false,
      }),
    );
    await assertSucceeds(setDoc(own(ownerDb, 'state/main'), mainState()));
    const badPreference = mainState();
    badPreference.metadata.preferences.theme = 'invented';
    await assertFails(setDoc(own(ownerDb, 'state/main'), badPreference));
    const badPosition = unit();
    badPosition.position.step = -1;
    await assertFails(setDoc(own(ownerDb, 'courseUnits/unit-1'), badPosition));
    const badReview = unit();
    badReview.review.intervalDays = 1000;
    await assertFails(setDoc(own(ownerDb, 'courseUnits/unit-1'), badReview));
    for (const mutate of [
      (value) => {
        value.value.correct = false;
      },
      (value) => {
        value.value.conceptIds = ['invented'];
      },
      (value) => {
        value.value.snapshot.id = 'another-check';
      },
      (value) => {
        value.value.snapshot.options[0].correct = false;
      },
      (value) => {
        value.value.snapshot.options = 'not an option list';
      },
      (value) => {
        value.value.admin = true;
      },
      (value) => {
        value.extra = true;
      },
      (value) => {
        value.order = -1;
      },
    ]) {
      const altered = answer();
      mutate(altered);
      await assertFails(
        setDoc(own(ownerDb, 'courseAttempts/attempt-1'), altered),
      );
    }
  },
);

run(
  'child writes require an initialized dataset or a valid initial import marker',
  async () => {
    await assertFails(
      setDoc(own(ownerDb, 'courseAttempts/attempt-1'), answer()),
    );
    await assertFails(setDoc(own(ownerDb, 'courseUnits/unit-1'), unit()));
    await assertFails(
      setDoc(own(ownerDb, 'state/import-main'), {
        ...marker(),
        status: 'ready',
      }),
    );
    await assertFails(
      setDoc(own(ownerDb, 'state/import-main'), {
        ...marker(),
        digest: 'invalid',
      }),
    );
    await assertSucceeds(setDoc(own(ownerDb, 'state/import-main'), marker()));
    await assertSucceeds(
      setDoc(own(ownerDb, 'courseAttempts/attempt-1'), answer()),
    );
    await assertSucceeds(setDoc(own(ownerDb, 'courseUnits/unit-1'), unit()));
    await assertFails(setDoc(own(ownerDb, 'state/main'), mainState()));
    await assertFails(
      updateDoc(own(ownerDb, 'state/import-main'), { status: 'ready' }),
    );
    await assertFails(
      updateDoc(own(ownerDb, 'state/import-main'), { digest: 'b'.repeat(64) }),
    );
    await assertFails(
      updateDoc(own(ownerDb, 'state/import-main'), {
        counts: { courseUnits: 9, courseAttempts: 9 },
      }),
    );
    const finish = writeBatch(ownerDb);
    finish.set(own(ownerDb, 'state/main'), mainState());
    finish.update(own(ownerDb, 'state/import-main'), { status: 'ready' });
    await assertSucceeds(finish.commit());
    await assertFails(
      updateDoc(own(ownerDb, 'state/import-main'), { status: 'importing' }),
    );
    await assertFails(deleteDoc(own(ownerDb, 'state/import-main')));
  },
);

run(
  'populated main data cannot be replaced by import but an uninitialized pilot can be adopted',
  async () => {
    await assertSucceeds(setDoc(own(ownerDb, 'state/main'), mainState()));
    await assertFails(setDoc(own(ownerDb, 'state/import-main'), marker()));
    await assertSucceeds(
      setDoc(own(ownerDb, 'state/import-pilot'), marker('pilot')),
    );
    const finish = writeBatch(ownerDb);
    finish.set(own(ownerDb, 'state/pilot'), pilotState());
    finish.update(own(ownerDb, 'state/import-pilot'), { status: 'ready' });
    await assertSucceeds(finish.commit());
  },
);

run(
  'pilot answer timing and ordinal can finish without rewriting the submitted evidence',
  async () => {
    await assertSucceeds(setDoc(own(ownerDb, 'state/pilot'), pilotState()));
    const ref = own(ownerDb, 'pilotAttempts/session-1%3A0');
    await assertSucceeds(setDoc(ref, pilotAnswer()));
    await assertSucceeds(updateDoc(ref, { 'value.explanationMs': 4200 }));
    await assertSucceeds(updateDoc(ref, { order: 2 }));
    await assertSucceeds(updateDoc(ref, { 'value.explanationMs': 4200 }));
    for (const patch of [
      { 'value.answerMs': 9999 },
      { 'value.chosen': 1 },
      { 'value.hintUsed': true },
      { 'value.questionSnapshot.stem': 'changed' },
      { order: -1 },
      { 'value.explanationMs': -1 },
    ])
      await assertFails(updateDoc(ref, patch));
    await assertFails(deleteDoc(ref));
  },
);

run(
  'pilot notes/reviews/sessions use bounded shapes and completed session evidence is immutable',
  async () => {
    await assertSucceeds(setDoc(own(ownerDb, 'state/pilot'), pilotState()));
    const note = {
      order: 0,
      value: {
        id: 'note-1',
        conceptId: 'identity',
        text: 'My own explanation.',
        createdAt: 1000,
      },
    };
    await assertSucceeds(setDoc(own(ownerDb, 'pilotNotes/note-1'), note));
    await assertSucceeds(
      updateDoc(own(ownerDb, 'pilotNotes/note-1'), {
        order: 1,
        'value.text': 'A clearer explanation.',
      }),
    );
    await assertSucceeds(
      setDoc(own(ownerDb, 'pilotReviews/identity'), {
        id: 'identity',
        value: review(),
      }),
    );
    const session = {
      order: 0,
      value: { id: 'session-1', completedAt: 2000, count: 4, elapsedMs: 10000 },
    };
    await assertSucceeds(
      setDoc(own(ownerDb, 'pilotSessions/session-1'), session),
    );
    await assertSucceeds(
      setDoc(own(ownerDb, 'pilotSessions/session-1'), session),
    );
    await assertFails(
      updateDoc(own(ownerDb, 'pilotSessions/session-1'), {
        'value.count': 10000,
      }),
    );
    await assertFails(deleteDoc(own(ownerDb, 'pilotSessions/session-1')));
    await assertFails(
      setDoc(own(ownerDb, 'pilotReviews/other'), {
        id: 'other',
        value: { ...review(), extra: true },
      }),
    );
  },
);

run(
  'all current unit and connection checks can retain their exact snapshots under the owner rules',
  async () => {
    const source = new URL('../lib/data/course/', import.meta.url);
    const checks = [];
    for (const [directory, field] of [
      ['units', 'teaching'],
      ['connections', 'model'],
    ]) {
      const folder = new URL(`${directory}/`, source);
      for (const file of fs
        .readdirSync(folder)
        .filter((name) => name.endsWith('.json'))) {
        const payload = JSON.parse(
          fs.readFileSync(new URL(file, folder), 'utf8'),
        );
        for (const phase of ['prediction', 'transfer', 'retry'])
          checks.push({
            unitId: payload.id,
            releaseId: payload.releaseId,
            kind: phase,
            check: payload[field][phase],
          });
      }
    }
    assert.equal(checks.length, 303);
    const answers = checks.flatMap((entry) =>
      entry.check.options.map((chosen) => ({ ...entry, chosen })),
    );
    assert.equal(answers.length, 913);
    const importing = {
      ...marker(),
      counts: { courseUnits: 0, courseAttempts: 913 },
    };
    await assertSucceeds(setDoc(own(ownerDb, 'state/import-main'), importing));
    for (let start = 0; start < answers.length; start += 149) {
      const batch = writeBatch(ownerDb);
      batch.set(own(ownerDb, 'state/import-main'), importing);
      for (const [offset, entry] of answers
        .slice(start, start + 149)
        .entries()) {
        const chosen = entry.chosen;
        const value = {
          id: `snapshot-${start + offset}`,
          unitId: entry.unitId,
          releaseId: entry.releaseId,
          questionId: entry.check.id,
          kind: entry.kind,
          selected: chosen.id,
          correct: chosen.correct,
          guess: false,
          hintUsed: false,
          outcomeViewed: false,
          at: 1000,
          conceptIds: entry.check.conceptIds,
          snapshot: entry.check,
        };
        batch.set(own(ownerDb, `courseAttempts/${value.id}`), {
          order: start + offset,
          value,
        });
      }
      try {
        await assertSucceeds(batch.commit());
      } catch (error) {
        const coverage = await fetch(
          `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}:ruleCoverage`,
        );
        fs.writeFileSync(
          new URL('../outputs/cloud-rule-coverage.json', import.meta.url),
          await coverage.text(),
        );
        throw new Error(
          `Current snapshot ${answers[start].check.id} rejected: ${error.message}`,
          { cause: error },
        );
      }
    }
    assert.equal(
      (await getDocs(collection(ownerDb, 'users/owner-test/courseAttempts')))
        .size,
      913,
    );
    const finish = writeBatch(ownerDb);
    finish.set(own(ownerDb, 'state/main'), mainState());
    finish.set(own(ownerDb, 'state/import-main'), {
      ...importing,
      status: 'ready',
    });
    await assertSucceeds(finish.commit());
  },
);
