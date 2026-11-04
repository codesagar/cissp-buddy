import type {
  CourseConnection,
  CourseConnectionsIndex,
  CourseManifest,
  CourseUnit,
  RecoveryTimelineData,
  TeachingCheck,
  TeachingModel,
} from './types.ts';

type TeachingScope = Pick<CourseUnit, 'id' | 'conceptIds'> & {
  sourceRefs: { id: string }[];
};

const fail = (message: string): never => {
  throw new Error(`Course validation: ${message}`);
};

const assertUnique = (ids: string[], label: string) => {
  if (new Set(ids).size !== ids.length) fail(`duplicate ${label} ID`);
};

const validateRecoveryTimeline = (
  quantitative: RecoveryTimelineData,
  label: string,
) => {
  const values = [
    quantitative.lastRecoverableAt,
    quantitative.interruptionAt,
    quantitative.rpoLimit,
    quantitative.restoreAt,
    quantitative.rtoLimit,
    quantitative.disruptionLimit,
    quantitative.acceptanceAt,
  ];
  if (
    quantitative.kind !== 'recovery-timeline' ||
    !['minutes', 'hours'].includes(quantitative.unit) ||
    !quantitative.description ||
    values.some((value) => !Number.isFinite(value)) ||
    quantitative.lastRecoverableAt > 0 ||
    quantitative.interruptionAt !== 0 ||
    quantitative.rpoLimit <= 0 ||
    quantitative.restoreAt < 0 ||
    quantitative.rtoLimit <= 0 ||
    quantitative.disruptionLimit <= 0 ||
    quantitative.acceptanceAt < quantitative.restoreAt ||
    quantitative.rtoLimit > quantitative.disruptionLimit
  )
    fail(`${label} has invalid recovery timeline values`);
};

const validateCheck = (
  check: TeachingCheck,
  model: TeachingModel,
  unit: TeachingScope,
  label: string,
  enforceSemanticInvariants: boolean,
) => {
  if (!check.id || !check.prompt || !check.hint || check.options.length < 2)
    fail(`${model.unitId} has incomplete ${label}`);
  assertUnique(
    check.options.map((option) => option.id),
    `${model.unitId}/${label} option`,
  );
  if (
    enforceSemanticInvariants &&
    new Set(check.options.map((option) => option.label)).size !==
      check.options.length
  )
    fail(`${model.unitId}/${label} has duplicate option labels`);
  if (check.options.filter((option) => option.correct).length !== 1)
    fail(`${model.unitId}/${label} must have exactly one correct option`);
  const stateIds = new Set([
    ...model.states.map((state) => state.id),
    ...(model.variants || []).flatMap((variant) =>
      variant.states.map((state) => state.id),
    ),
  ]);
  for (const option of check.options) {
    if (!option.id || !option.label || !option.feedback)
      fail(`${model.unitId}/${label} has an incomplete option`);
    if (!stateIds.has(option.repairStateId))
      fail(`${model.unitId}/${label}/${option.id} has an unknown repair state`);
  }
  for (const conceptId of check.conceptIds)
    if (!unit.conceptIds.includes(conceptId))
      fail(`${model.unitId}/${label} references undeclared ${conceptId}`);
};

export const validateTeaching = (
  model: TeachingModel,
  unit: TeachingScope,
  enforceSemanticInvariants = false,
) => {
  if (model.schemaVersion !== 1 || model.unitId !== unit.id)
    fail(`${unit.id} teaching identity mismatch`);
  if (
    !model.title ||
    !model.question ||
    !model.scenario ||
    !model.focalRelation ||
    !model.takeaway ||
    !model.nodes.length ||
    !model.states.length ||
    !model.sourceRefIds.length
  )
    fail(`${unit.id} teaching model is incomplete`);
  if (
    ![
      'decision',
      'boundary',
      'sequence',
      'state',
      'comparison',
      'ledger',
      'timeline',
      'quantitative',
    ].includes(model.representation)
  )
    fail(`${unit.id} has an unsupported teaching representation`);
  if (model.quantitative) validateRecoveryTimeline(model.quantitative, unit.id);
  for (const variant of model.variants || [])
    if (variant.quantitative)
      validateRecoveryTimeline(
        variant.quantitative,
        `${unit.id}/${variant.id}`,
      );
  assertUnique(
    model.states.map((state) => state.id),
    `${unit.id} teaching state`,
  );
  assertUnique(model.treatmentIds, `${unit.id} treatment`);
  assertUnique(
    model.treatmentDispositions.map((item) => item.treatmentId),
    `${unit.id} treatment disposition`,
  );
  assertUnique(
    (model.variants || []).map((variant) => variant.id),
    `${unit.id} teaching variant`,
  );
  const allStates = [
    ...model.states,
    ...(model.variants || []).flatMap((variant) => variant.states),
  ];
  assertUnique(
    allStates.map((state) => state.id),
    `${unit.id} teaching state across variants`,
  );
  const validateGraph = (
    label: string,
    nodes: TeachingModel['nodes'],
    edges: TeachingModel['edges'],
    lanes: NonNullable<TeachingModel['lanes']>,
    states: TeachingModel['states'],
    matrix: TeachingModel['matrix'],
  ) => {
    assertUnique(
      nodes.map((node) => node.id),
      `${label} teaching node`,
    );
    assertUnique(
      lanes.map((lane) => lane.id),
      `${label} teaching lane`,
    );
    const nodeIds = new Set(nodes.map((node) => node.id));
    const laneIds = new Set(lanes.map((lane) => lane.id));
    for (const node of nodes) {
      if (!node.label || !node.detail)
        fail(`${label}/${node.id} teaching node is incomplete`);
      for (const conceptId of node.conceptIds)
        if (!unit.conceptIds.includes(conceptId))
          fail(`${label}/${node.id} references undeclared ${conceptId}`);
      if (node.lane && !laneIds.has(node.lane))
        fail(`${label}/${node.id} references unknown lane ${node.lane}`);
    }
    if (
      enforceSemanticInvariants &&
      ['boundary', 'ledger'].includes(model.representation) &&
      [...laneIds].some((laneId) => !nodes.some((node) => node.lane === laneId))
    )
      fail(`${label} declares an empty teaching lane`);
    for (const edge of edges)
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to) || !edge.label)
        fail(`${label} has a dangling or unlabeled teaching edge`);
    for (const state of states) {
      const activeNodeIds = new Set(state.activeNodeIds);
      for (const nodeId of state.activeNodeIds)
        if (!nodeIds.has(nodeId))
          fail(`${label}/${state.id} activates unknown node ${nodeId}`);
      for (const edgeIndex of state.activeEdgeIndexes || [])
        if (
          !Number.isInteger(edgeIndex) ||
          edgeIndex < 0 ||
          edgeIndex >= edges.length
        )
          fail(`${label}/${state.id} activates unknown edge ${edgeIndex}`);
        else {
          const edge = edges[edgeIndex];
          if (
            enforceSemanticInvariants &&
            (!activeNodeIds.has(edge.from) || !activeNodeIds.has(edge.to))
          )
            fail(
              `${label}/${state.id} activates edge ${edgeIndex} without both endpoints`,
            );
        }
      for (const nodeId of Object.keys(state.statuses || {}))
        if (!nodeIds.has(nodeId))
          fail(`${label}/${state.id} gives status to unknown node ${nodeId}`);
      const rowIds = new Set(matrix?.rows.map((row) => row.id) || []);
      for (const rowId of state.activeRowIds || [])
        if (!rowIds.has(rowId))
          fail(`${label}/${state.id} activates unknown matrix row ${rowId}`);
    }
    if (matrix) {
      if (
        !matrix.title ||
        !matrix.description ||
        matrix.columns.length < 2 ||
        matrix.rows.length < 2
      )
        fail(`${label} has an incomplete comparison matrix`);
      assertUnique(
        matrix.columns.map((column) => column.id),
        `${label} matrix column`,
      );
      assertUnique(
        matrix.rows.map((row) => row.id),
        `${label} matrix row`,
      );
      for (const row of matrix.rows)
        for (const column of matrix.columns)
          if (!row.cells[column.id])
            fail(`${label}/${row.id} lacks matrix cell ${column.id}`);
    }
  };
  validateGraph(
    unit.id,
    model.nodes,
    model.edges,
    model.lanes || [],
    model.states,
    model.matrix,
  );
  for (const variant of model.variants || [])
    validateGraph(
      `${unit.id}/${variant.id}`,
      variant.nodes || model.nodes,
      variant.edges || model.edges,
      variant.lanes || model.lanes || [],
      variant.states,
      variant.matrix || model.matrix,
    );
  for (const disposition of model.treatmentDispositions)
    if (
      !model.treatmentIds.includes(disposition.treatmentId) ||
      !disposition.rationale
    )
      fail(`${unit.id} has an invalid treatment disposition`);
  for (const sourceRefId of model.sourceRefIds)
    if (!unit.sourceRefs.some((sourceRef) => sourceRef.id === sourceRefId))
      fail(`${unit.id} teaching references unknown source ${sourceRefId}`);
  validateCheck(
    model.prediction,
    model,
    unit,
    'prediction',
    enforceSemanticInvariants,
  );
  validateCheck(
    model.transfer,
    model,
    unit,
    'transfer',
    enforceSemanticInvariants,
  );
  validateCheck(model.retry, model, unit, 'retry', enforceSemanticInvariants);
  const correctLabel = (check: TeachingCheck) =>
    check.options.find((option) => option.correct)?.label;
  if (
    enforceSemanticInvariants &&
    (model.transfer.prompt === model.retry.prompt ||
      correctLabel(model.transfer) === correctLabel(model.retry))
  )
    fail(`${unit.id} transfer and retry checks must be distinct`);
};

export function validateCourseUnit(
  unit: CourseUnit,
  enforceSemanticInvariants = false,
): CourseUnit {
  if (
    !unit.id ||
    !unit.title ||
    !unit.summary ||
    !unit.outcome ||
    !unit.sourcePath ||
    !/^[a-f0-9]{64}$/.test(unit.sourceHash) ||
    !unit.releaseId ||
    !Number.isInteger(unit.domainId) ||
    unit.domainId < 1 ||
    unit.domainId > 8 ||
    !Number.isInteger(unit.estimatedMinutes) ||
    unit.estimatedMinutes < 1
  )
    fail(`${unit.id || 'unknown unit'} has incomplete metadata`);
  assertUnique(unit.conceptIds, `${unit.id} concept occurrence`);
  assertUnique(
    unit.concepts.map((concept) => concept.id),
    `${unit.id} concept`,
  );
  assertUnique(
    unit.sections.map((section) => section.id),
    `${unit.id} section`,
  );
  assertUnique(
    unit.sourceRefs.map((sourceRef) => sourceRef.id),
    `${unit.id} source`,
  );
  if (
    unit.concepts.length !== unit.conceptIds.length ||
    unit.concepts.some(
      (concept, index) => concept.id !== unit.conceptIds[index],
    )
  )
    fail(`${unit.id} concept payloads do not match declared occurrence order`);
  const sourceIds = new Set(unit.sourceRefs.map((sourceRef) => sourceRef.id));
  for (const section of unit.sections) {
    if (!section.title || !section.body || !section.keyPoints.length)
      fail(`${unit.id}/${section.id} section is incomplete`);
    for (const sourceRefId of section.sourceRefIds)
      if (!sourceIds.has(sourceRefId))
        fail(
          `${unit.id}/${section.id} references unknown source ${sourceRefId}`,
        );
  }
  for (const concept of unit.concepts) {
    if (
      !concept.label ||
      !concept.definition ||
      !concept.decision ||
      !concept.failureExample ||
      !concept.sourceVisualId ||
      !concept.sourceRefIds.length
    )
      fail(`${unit.id}/${concept.id} lacks substantive visual explanation`);
    for (const sourceRefId of concept.sourceRefIds)
      if (!sourceIds.has(sourceRefId))
        fail(
          `${unit.id}/${concept.id} references unknown source ${sourceRefId}`,
        );
  }
  if (unit.teaching)
    validateTeaching(unit.teaching, unit, enforceSemanticInvariants);
  return unit;
}

export function validateCourseRelease(
  manifest: CourseManifest,
  units: CourseUnit[],
  enforceSemanticInvariants = false,
): CourseManifest {
  if (
    !manifest.releaseId ||
    !manifest.releaseId.endsWith(manifest.sourceHash.slice(0, 16)) ||
    !/^[a-f0-9]{64}$/.test(manifest.sourceHash) ||
    Number.isNaN(Date.parse(manifest.publishedAt))
  )
    fail('manifest provenance is invalid');
  if (manifest.domains.length !== 8)
    fail('manifest must contain eight domains');
  assertUnique(
    manifest.domains.map((domain) => String(domain.id)),
    'domain',
  );
  assertUnique(
    manifest.units.map((unit) => unit.id),
    'unit summary',
  );
  assertUnique(
    units.map((unit) => unit.id),
    'unit payload',
  );
  if (manifest.units.length !== units.length || units.length !== 90)
    fail('manifest/unit payload count mismatch');
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  for (const unit of units) validateCourseUnit(unit, enforceSemanticInvariants);
  for (const summary of manifest.units) {
    const unit =
      unitById.get(summary.id) ?? fail(`${summary.id} has no unit payload`);
    if (
      unit.releaseId !== manifest.releaseId ||
      unit.domainId !== summary.domainId ||
      unit.title !== summary.title ||
      unit.summary !== summary.summary ||
      unit.outcome !== summary.outcome ||
      unit.estimatedMinutes !== summary.estimatedMinutes ||
      summary.teachingReady !== Boolean(unit.teaching) ||
      (summary.prerequisites !== undefined &&
        JSON.stringify(summary.prerequisites) !==
          JSON.stringify(unit.prerequisites)) ||
      (summary.checks !== undefined &&
        JSON.stringify(
          summary.checks.map(({ id, conceptIds }) => [id, conceptIds]),
        ) !==
          JSON.stringify(
            unit.teaching
              ? [
                  unit.teaching.prediction,
                  unit.teaching.transfer,
                  unit.teaching.retry,
                ].map(({ id, conceptIds }) => [id, conceptIds])
              : [],
          )) ||
      JSON.stringify(unit.objectiveIds) !==
        JSON.stringify(summary.objectiveIds) ||
      JSON.stringify(unit.conceptIds) !== JSON.stringify(summary.conceptIds) ||
      (summary.conceptLabels !== undefined &&
        JSON.stringify(unit.concepts.map((concept) => concept.label)) !==
          JSON.stringify(summary.conceptLabels))
    )
      fail(`${summary.id} summary differs from unit payload`);
  }
  const distinctConcepts = new Set(units.flatMap((unit) => unit.conceptIds));
  const occurrences = units.reduce(
    (count, unit) => count + unit.conceptIds.length,
    0,
  );
  const teachingModels = units.filter((unit) => unit.teaching).length;
  const expected = {
    units: 90,
    concepts: 698,
    conceptOccurrences: 892,
    teachingModels,
    assessments: teachingModels * 3,
  };
  if (
    Object.entries(expected).some(
      ([key, value]) =>
        manifest.counts[key as keyof CourseManifest['counts']] !== value,
    )
  )
    fail('manifest coverage counts are incorrect');
  if (distinctConcepts.size !== 698 || occurrences !== 892)
    fail('canonical concept coverage is incomplete');
  return manifest;
}

export function validateCourseConnections(
  index: CourseConnectionsIndex,
  connections: CourseConnection[],
  units: CourseUnit[],
  enforceSemanticInvariants = false,
): CourseConnectionsIndex {
  if (!index.releaseId || index.cases.length !== 11)
    fail('connection index identity or case count is invalid');
  if (index.referenceRelationships.length !== 21)
    fail('connection reference relationship count is invalid');
  if (connections.length !== index.cases.length)
    fail('connection index/payload count mismatch');
  assertUnique(
    index.cases.map((item) => item.id),
    'connection summary',
  );
  assertUnique(
    connections.map((item) => item.id),
    'connection payload',
  );
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const connectionById = new Map(
    connections.map((connection) => [connection.id, connection]),
  );
  const taughtRelationshipIds = index.cases.flatMap(
    (item) => item.relationshipIds,
  );
  const referenceRelationshipIds = index.referenceRelationships.map(
    (item) => item.id,
  );
  if (
    taughtRelationshipIds.length !== 18 ||
    new Set(taughtRelationshipIds).size !== 18 ||
    new Set(referenceRelationshipIds).size !== 21 ||
    taughtRelationshipIds.some((id) => referenceRelationshipIds.includes(id))
  )
    fail('connection relationship partition is invalid');
  for (const relationship of index.referenceRelationships)
    if (
      !relationship.id ||
      !relationship.fromObjectiveId ||
      !relationship.toObjectiveId ||
      !relationship.kind ||
      relationship.directionality !== 'directed' ||
      !relationship.rationale ||
      !relationship.storyboardId ||
      !relationship.reason ||
      !relationship.sourceSupport.note ||
      !relationship.sourceSupport.sourceIds.length
    )
      fail(`${relationship.id || 'unknown'} reference relationship is invalid`);
  for (const summary of index.cases) {
    const connection =
      connectionById.get(summary.id) ??
      fail(`${summary.id} has no connection payload`);
    if (
      connection.releaseId !== index.releaseId ||
      connection.title !== summary.title ||
      JSON.stringify(connection.unitIds) !== JSON.stringify(summary.unitIds) ||
      JSON.stringify(connection.relationshipIds) !==
        JSON.stringify(summary.relationshipIds)
    )
      fail(`${summary.id} connection summary differs from its payload`);
    const sourceUnits = summary.unitIds.map(
      (unitId) =>
        unitById.get(unitId) ??
        fail(`${summary.id} references unknown unit ${unitId}`),
    );
    const conceptIds = [
      ...new Set(sourceUnits.flatMap((unit) => unit.conceptIds)),
    ];
    const sourceRefs = [
      ...new Map(
        sourceUnits
          .flatMap((unit) => unit.sourceRefs)
          .map((sourceRef) => [sourceRef.id, sourceRef]),
      ).values(),
    ];
    validateTeaching(
      connection.model,
      {
        id: connection.id,
        conceptIds,
        sourceRefs,
      },
      enforceSemanticInvariants,
    );
  }
  return index;
}
