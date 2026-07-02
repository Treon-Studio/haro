import type { OkfDocument, LinkGraph, TagIndex, CategoryIndex } from '../types/okf';

export function buildTagIndex(docs: OkfDocument[]): TagIndex {
  const index: TagIndex = {};

  for (const doc of docs) {
    for (const tag of doc.metadata.tags) {
      if (!index[tag]) index[tag] = [];
      if (!index[tag].includes(doc.id)) index[tag].push(doc.id);
    }
  }

  return index;
}

export function buildCategoryIndex(docs: OkfDocument[]): CategoryIndex {
  const index: CategoryIndex = {};

  for (const doc of docs) {
    const cat = doc.metadata.category;
    if (!index[cat]) {
      index[cat] = { docs: [], subcategories: {} };
    }
    if (!index[cat].docs.includes(doc.id)) index[cat].docs.push(doc.id);

    for (const tag of doc.metadata.tags) {
      if (!index[cat].subcategories[tag]) index[cat].subcategories[tag] = [];
      if (!index[cat].subcategories[tag].includes(doc.id)) {
        index[cat].subcategories[tag].push(doc.id);
      }
    }
  }

  return index;
}

export function buildLinkGraph(docs: OkfDocument[]): LinkGraph {
  const graph: LinkGraph = {};

  for (const doc of docs) {
    graph[doc.id] = {
      outgoing: [...doc.references.explicit, ...doc.references.implicit],
      incoming: [],
      related_score: {},
    };
  }

  for (const doc of docs) {
    for (const ref of graph[doc.id].outgoing) {
      if (graph[ref]) {
        if (!graph[ref].incoming.includes(doc.id)) {
          graph[ref].incoming.push(doc.id);
        }
      }
    }
  }

  for (const [id, node] of Object.entries(graph)) {
    for (const out of node.outgoing) {
      node.related_score[out] = calculateStrength(id, out, docs);
    }
  }

  return graph;
}

function calculateStrength(source: string, target: string, docs: OkfDocument[]): number {
  const sourceDoc = docs.find(d => d.id === source);
  const targetDoc = docs.find(d => d.id === target);
  if (!sourceDoc || !targetDoc) return 0.5;

  let strength = 0.5;

  if (sourceDoc.references.explicit.includes(target)) strength += 0.3;
  if (sourceDoc.references.implicit.includes(target)) strength += 0.1;
  if (sourceDoc.metadata.parent === target || targetDoc.metadata.parent === source) strength += 0.2;

  const sharedTags = sourceDoc.metadata.tags.filter(t => targetDoc.metadata.tags.includes(t));
  strength += sharedTags.length * 0.05;

  if (sourceDoc.metadata.category === targetDoc.metadata.category) strength += 0.1;

  return Math.min(strength, 1.0);
}

export function updateIndexesForDoc(
  doc: OkfDocument,
  tags: TagIndex,
  categories: CategoryIndex,
  graph: LinkGraph,
): void {
  for (const tag of doc.metadata.tags) {
    if (!tags[tag]) tags[tag] = [];
    if (!tags[tag].includes(doc.id)) tags[tag].push(doc.id);
  }

  const cat = doc.metadata.category;
  if (!categories[cat]) categories[cat] = { docs: [], subcategories: {} };
  if (!categories[cat].docs.includes(doc.id)) categories[cat].docs.push(doc.id);

  graph[doc.id] = {
    outgoing: [...doc.references.explicit, ...doc.references.implicit],
    incoming: [],
    related_score: {},
  };
}

export function removeFromIndexes(
  id: string,
  tags: TagIndex,
  categories: CategoryIndex,
  graph: LinkGraph,
): void {
  for (const tag of Object.keys(tags)) {
    tags[tag] = tags[tag].filter(docId => docId !== id);
    if (tags[tag].length === 0) delete tags[tag];
  }

  for (const cat of Object.keys(categories)) {
    categories[cat].docs = categories[cat].docs.filter(docId => docId !== id);
    for (const subcat of Object.keys(categories[cat].subcategories)) {
      categories[cat].subcategories[subcat] = categories[cat].subcategories[subcat].filter(
        docId => docId !== id,
      );
      if (categories[cat].subcategories[subcat].length === 0) {
        delete categories[cat].subcategories[subcat];
      }
    }
    if (categories[cat].docs.length === 0) delete categories[cat];
  }

  for (const node of Object.values(graph)) {
    node.outgoing = node.outgoing.filter(docId => docId !== id);
    node.incoming = node.incoming.filter(docId => docId !== id);
  }
  delete graph[id];
}
