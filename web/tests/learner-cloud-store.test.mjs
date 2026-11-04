import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  disableNetwork,
  enableNetwork,
  getDocFromServer,
  getDocsFromServer,
  doc,
} from 'firebase/firestore';
import {
  loadDataset,
  saveDataset,
  adoptDataset,
  cloudRecordId,
  IncompleteImportError,
} from '../lib/learner/cloud-store.ts';
import {
  emptyLearnerState,
  newPosition,
  recordCourseAnswer,
  validateLearnerState,
} from '../lib/course/learner-state.ts';
import {
  validateBackup,
  recordAnswer,
  advanceSession,
} from '../lib/study-state.ts';

const enabled = process.env.CISSP_CLOUD_TESTS === '1';
const projectId = 'demo-cissp-buddy';
const ownerUid = 'owner-test';
const read = (file) =>
  JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const lessons = read('../lib/data/lessons.json');
const questions = read('../lib/data/questions.json');
const validatePilot = (value) =>
  validateBackup(
    value,
    lessons.map((lesson) => lesson.id),
    questions,
  );
const productionRules = fs.readFileSync(
  new URL('../../firestore.rules', import.meta.url),
  'utf8',
);
const assignment = "let approvedUid = 'OWNER_UID_NOT_CONFIGURED';";
const rules = productionRules.replace(
  assignment,
  `let approvedUid = '${ownerUid}';`,
);
let environment, db;
const run = (name, work) => test(name, { skip: !enabled }, work);
async function openEnvironment(selectedRules = rules) {
  const address = process.env.FIRESTORE_EMULATOR_HOST || '';
  assert.match(
    address,
    /^(127\.0\.0\.1|localhost):\d+$/,
    'Cloud tests require a loopback emulator',
  );
  assert.equal(
    process.env.GCLOUD_PROJECT || projectId,
    projectId,
    'Cloud tests never use a real project',
  );
  const [host, port] = address.split(':');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host, port: Number(port), rules: selectedRules },
  });
  db = environment.authenticatedContext(ownerUid).firestore();
}
before(async () => {
  if (enabled) await openEnvironment();
});
beforeEach(async () => {
  if (enabled) await environment.clearFirestore();
});
after(async () => {
  if (environment) await environment.cleanup();
});

const now = 1793799741000;
const check = {
  id: 'cloud-check',
  prompt: 'Which actor must enforce this access decision?',
  conceptIds: ['authorization'],
  hint: 'Separate deciding from enforcement.',
  options: [
    {
      id: 'api',
      label: 'The API enforcement point',
      correct: true,
      feedback: 'The API controls this request.',
      repairStateId: 'gate',
    },
    {
      id: 'person',
      label: 'The authenticated person',
      correct: false,
      feedback: 'Authentication alone does not enforce this policy.',
      repairStateId: 'gate',
    },
  ],
};
function course() {
  const state = emptyLearnerState();
  state.lastUnitId = 'unit-1';
  state.units['unit-1'] = {
    ...newPosition(now),
    note: 'Keep the enforcement boundary explicit.',
    exploration: { workedOutcomeVisible: true, assignment: 'unknown' },
    checks: { [check.id]: { selected: 'person', guess: true, hintUsed: true } },
  };
  const answered = recordCourseAnswer(
    state,
    'unit-1',
    check,
    'prediction',
    'historical-release',
    now,
    'answer/legacy:1',
  );
  answered.reviews['historical-unit'] = {
    dueAt: now,
    lastAt: now,
    intervalDays: 1,
    needsReview: true,
  };
  return answered;
}
function history(count, { longPrompt = false, blockedFinal = false } = {}) {
  const state = course();
  const template = state.attempts[0];
  state.attempts = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(template),
    id:
      i === 0
        ? template.id
        : blockedFinal && i === count - 1
          ? 'blocked-final'
          : `history-${i}`,
    at: count - i,
    snapshot: {
      ...structuredClone(template.snapshot),
      ...(longPrompt ? { prompt: 'P'.repeat(2000) } : {}),
    },
  }));
  return state;
}
const root = () => doc(db, 'users', ownerUid, 'state', 'main');

run(
  'server-confirmed absence is distinct from authorization failure and offline reads',
  async () => {
    assert.equal(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      null,
    );
    const stranger = environment
      .authenticatedContext('someone-else')
      .firestore();
    await assert.rejects(
      loadDataset(stranger, ownerUid, 'course', validateLearnerState),
      /permission|insufficient/i,
    );
    await disableNetwork(db);
    try {
      await assert.rejects(
        loadDataset(db, ownerUid, 'course', validateLearnerState),
        /offline|network|unavailable/i,
      );
    } finally {
      await enableNetwork(db);
    }
  },
);

run(
  'initial adoption and full server hydration preserve historical order, snapshots and encoded original IDs',
  async () => {
    const source = history(3);
    assert.deepEqual(
      await adoptDataset(db, ownerUid, 'course', source),
      source,
    );
    const restored = await loadDataset(
      db,
      ownerUid,
      'course',
      validateLearnerState,
    );
    assert.deepEqual(restored, source);
    assert.equal(restored.attempts[0].id, 'answer/legacy:1');
    assert.equal(cloudRecordId(restored.attempts[0].id), 'answer%2Flegacy%3A1');
    assert.deepEqual(
      restored.attempts.map((attempt) => attempt.at),
      [3, 2, 1],
      'Original append order is not rewritten by clock ordering',
    );
    assert.deepEqual(
      await adoptDataset(db, ownerUid, 'course', source),
      source,
      'Lost-ack retry of the same source is idempotent',
    );
    const replacement = structuredClone(source);
    replacement.units['unit-1'].note = 'Another source';
    await assert.rejects(
      adoptDataset(db, ownerUid, 'course', replacement),
      /already initialized/,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      source,
    );
  },
);

run(
  'normal saves atomically retain new answers and do not clobber concurrent review/checks on a stale note edit',
  async () => {
    const initial = course();
    await adoptDataset(db, ownerUid, 'course', initial);
    const nextCheck = { ...structuredClone(check), id: 'changed-retry' };
    let remote = structuredClone(initial);
    remote.units['unit-1'].checks[nextCheck.id] = {
      selected: 'api',
      guess: false,
      hintUsed: false,
    };
    remote = recordCourseAnswer(
      remote,
      'unit-1',
      nextCheck,
      'retry',
      'release-next',
      now + 1000,
      'retry-answer',
    );
    await saveDataset(db, ownerUid, 'course', initial, remote);
    const staleNote = structuredClone(initial);
    staleNote.units['unit-1'].note = 'A note from the other device';
    await saveDataset(db, ownerUid, 'course', initial, staleNote);
    const expected = structuredClone(remote);
    expected.units['unit-1'].note = staleNote.units['unit-1'].note;
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      expected,
    );
    const revision = (await getDocFromServer(root())).data().revision;
    await saveDataset(
      db,
      ownerUid,
      'course',
      expected,
      structuredClone(expected),
    );
    assert.equal(
      (await getDocFromServer(root())).data().revision,
      revision,
      'Equivalent state does not cause another cloud write',
    );
  },
);

run(
  'one atomic 450-write offline catch-up keeps the last answer pointer and review coherent',
  async () => {
    const initial = course();
    await adoptDataset(db, ownerUid, 'course', initial);
    let pending = structuredClone(initial);
    for (let i = 0; i < 448; i++) {
      pending.units['unit-1'].checks[check.id] = {
        selected: 'api',
        guess: false,
        hintUsed: false,
      };
      pending = recordCourseAnswer(
        pending,
        'unit-1',
        check,
        'retry',
        'release-next',
        now + i + 1,
        `offline-answer-${i}`,
      );
    }
    // 448 new attempt documents + one changed unit + one metadata document.
    await saveDataset(db, ownerUid, 'course', initial, pending);
    const restored = await loadDataset(
      db,
      ownerUid,
      'course',
      validateLearnerState,
    );
    assert.deepEqual(restored, pending);
    assert.equal(
      restored.units['unit-1'].checks[check.id].submittedAttemptId,
      'offline-answer-447',
    );
    assert.equal(restored.attempts.length, 449);
    assert.equal(restored.reviews['unit-1'].needsReview, false);
  },
);

run(
  'clearing a pilot takeaway deletes its mutable cloud record and does not resurrect on reload',
  async () => {
    const initial = validatePilot(read('./fixtures/pilot-backup-v1.json'));
    initial.notes = [
      {
        id: 'clear-this-note',
        conceptId: 'identity',
        text: 'An old takeaway',
        createdAt: now,
      },
    ];
    await adoptDataset(db, ownerUid, 'pilot', initial, validatePilot);
    const cleared = structuredClone(initial);
    cleared.notes = [];
    await saveDataset(db, ownerUid, 'pilot', initial, cleared, validatePilot);
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'pilot', validatePilot),
      cleared,
    );
  },
);

run(
  'normal pilot saves reject lost or rewritten completed sessions without deleting history',
  async () => {
    const initial = validatePilot(read('./fixtures/pilot-backup-v1.json'));
    initial.sessions = [
      { id: 'completed-quiz', completedAt: now, count: 4, elapsedMs: 10000 },
    ];
    await adoptDataset(db, ownerUid, 'pilot', initial, validatePilot);
    const lost = structuredClone(initial);
    lost.sessions = [];
    await assert.rejects(
      saveDataset(db, ownerUid, 'pilot', initial, lost, validatePilot),
      /cannot remove or rewrite/,
    );
    const changed = structuredClone(initial);
    changed.sessions[0].count = 3;
    await assert.rejects(
      saveDataset(db, ownerUid, 'pilot', initial, changed, validatePilot),
      /cannot remove or rewrite/,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'pilot', validatePilot),
      initial,
    );
  },
);

run(
  'large history crosses hydration pages without becoming a metadata blob or truncating evidence',
  async () => {
    const source = history(800, { longPrompt: true });
    assert.ok(Buffer.byteLength(JSON.stringify(source.attempts)) > 1_048_576);
    await adoptDataset(db, ownerUid, 'course', source);
    assert.ok(
      Buffer.byteLength(
        JSON.stringify((await getDocFromServer(root())).data()),
      ) < 1024,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      source,
    );
  },
);

run(
  'interrupted multi-batch adoption stays non-ready and resumes only its exact original source',
  async () => {
    const source = history(320, { blockedFinal: true });
    const needle =
      "allow create: if writable(uid, 'main') && ordered(request.resource.data)";
    assert.ok(
      rules.includes(needle),
      'Transient-denial fixture matches the current create rule',
    );
    const temporarilyRestricted = rules.replace(
      needle,
      "allow create: if writable(uid, 'main') && request.resource.data.value.id != 'blocked-final' && ordered(request.resource.data)",
    );
    await environment.cleanup();
    await openEnvironment(temporarilyRestricted);
    await assert.rejects(
      adoptDataset(db, ownerUid, 'course', source),
      /permission|insufficient/i,
    );
    await assert.rejects(
      loadDataset(db, ownerUid, 'course', validateLearnerState),
      IncompleteImportError,
    );
    const partialCount = (
      await getDocsFromServer(
        collection(db, 'users', ownerUid, 'courseAttempts'),
      )
    ).size;
    assert.ok(partialCount > 0 && partialCount < source.attempts.length);
    const changed = structuredClone(source);
    changed.units['unit-1'].note = 'Different import';
    await assert.rejects(
      adoptDataset(db, ownerUid, 'course', changed),
      IncompleteImportError,
    );
    await environment.cleanup();
    await openEnvironment();
    assert.deepEqual(
      await adoptDataset(db, ownerUid, 'course', source),
      source,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      source,
    );
  },
);

run(
  'an initialized main course does not prevent independent pilot adoption and later explanation timing completion',
  async () => {
    const main = course();
    await adoptDataset(db, ownerUid, 'course', main);
    let pilot = validatePilot(read('./fixtures/pilot-backup-v1.json'));
    assert.equal(await loadDataset(db, ownerUid, 'pilot', validatePilot), null);
    await adoptDataset(db, ownerUid, 'pilot', pilot, validatePilot);
    const question = questions.find(
      (q) => q.id === pilot.active.questionIds[0],
    );
    const beforeAnswer = structuredClone(pilot);
    pilot.active.selected = 0;
    pilot = recordAnswer(pilot, question, now);
    await saveDataset(
      db,
      ownerUid,
      'pilot',
      beforeAnswer,
      pilot,
      validatePilot,
    );
    const beforeTiming = structuredClone(pilot);
    pilot.active.phaseMs = 2500;
    pilot.active.elapsedMs += 2500;
    pilot = advanceSession(pilot, now + 2500);
    await saveDataset(
      db,
      ownerUid,
      'pilot',
      beforeTiming,
      pilot,
      validatePilot,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'pilot', validatePilot),
      pilot,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      main,
    );
  },
);

run(
  'immutable-answer and excessive-diff failures preserve the previously saved dataset',
  async () => {
    const source = course();
    await adoptDataset(db, ownerUid, 'course', source);
    const changed = structuredClone(source);
    changed.attempts[0].snapshot.prompt = 'Rewritten';
    await assert.rejects(
      saveDataset(db, ownerUid, 'course', source, changed),
      /cannot remove or rewrite/,
    );
    const tooMany = structuredClone(source);
    tooMany.attempts.push(
      ...Array.from({ length: 600 }, (_, i) => ({
        ...structuredClone(source.attempts[0]),
        id: `extra-${i}`,
      })),
    );
    await assert.rejects(
      saveDataset(db, ownerUid, 'course', source, tooMany),
      /Too many unsynced/,
    );
    assert.deepEqual(
      await loadDataset(db, ownerUid, 'course', validateLearnerState),
      source,
    );
  },
);
